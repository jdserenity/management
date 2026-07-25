import type { SqlDatabase } from '@mgmt/storage';
import { normalizeApiUrl } from './apiUrl';
import { logSyncError, logSyncHttpFailure, logSyncInfo, summarizeUserDataCounts } from './syncLog';
import { inferSyncUserDataTablesFromSql } from './syncRegistry';
import { drainSyncOutbox, enqueueSyncPatch } from './syncOutbox';
import { syncFetch } from './syncFetch';
import { assertSafeSnapshotPush, isUserDataEmpty } from './userDataSafety';
import { markLocalSyncChangePending, markSyncPullResult, markSyncPushResult } from './syncStatus';
import {
  USER_DATA_TABLE_SCHEMAS,
  clientInsertSql,
  clientSelectSql,
  schemaByField
} from './userDataSchema';
import { withDataSyncWriteLock } from './syncWriteLock';

/** Wrapped DB → underlying DB so hydrate can rewrite tables without re-entering wrapWithDataSync. */
const rawSqlDatabases = new WeakMap<SqlDatabase, SqlDatabase>();

export const getRawSqlDatabase = (db: SqlDatabase): SqlDatabase => rawSqlDatabases.get(db) ?? db;

// ── Row types — mirror local.db columns (no user_id) ──────────────────────────

export interface FocusLogRow {
  id: string; session_type: string; completed_at: number;
  duration_minutes: number; planned_duration_minutes: number | null; completion_ratio: number | null;
}
export interface WorkoutLogRow {
  id: string; workout_id: string; workout_name: string; completed_at: number;
  exercises_json: string; total_reps: number; total_timed_seconds: number; completion_ratio: number | null;
}
export interface AppKvRow { key: string; value: string; updated_at: number; }
export interface NutritionConfig { tdee: number; protein: number; log_day: string; updated_at: string; }
export interface NutritionStaple {
  id: string; name: string; calories: number; protein: number;
  ingredients_json: string | null; sort_order: number; updated_at: string;
}
export interface NutritionRegular {
  id: string; name: string; calories: number; protein: number;
  ingredients_json: string | null; sort_order: number; updated_at: string;
}
export interface NutritionEntry {
  id: string; log_day: string; kind: string; ref_id: string | null;
  label: string; calories: number; protein: number; count: number;
  updated_at: string; deleted: number;
}
export interface WaterConfig { target_ml: number; log_day: string; updated_at: string; }
export interface WaterEntry {
  id: string; log_day: string; label: string; ml: number;
  count: number; updated_at: string; deleted: number;
}
export interface StreakActivity {
  id: string; name: string; description: string | null; frequency: string;
  weekly_target: number | null; scheduled_days_json: string | null;
  can_fail: number; necessary: number; archived_at: string | null; sort_order: number;
  linked_staple_id: string | null; linked_water: number; linked_movement_burst: number;
  extra_calories: number | null; extra_protein: number | null; extra_water_ml: number | null;
  updated_at: string;
}
export interface StreakLogCell { log_date: string; activity_id: string; state: string; updated_at: string; }
export interface StreakActivityMeta {
  activity_id: string; start_date: string | null; pause_since: string | null;
  unpaused_at: string | null; reset_count: number; updated_at: string;
}
/** Hard-delete record so pull-merge can drop ghost rows (absence alone is ambiguous). */
export interface SyncTombstone {
  entity: string;
  row_key: string;
  deleted_at: string;
}

export interface UserData {
  focusLog: FocusLogRow[];
  workoutLog: WorkoutLogRow[];
  appKv: AppKvRow[];
  nutritionConfig: NutritionConfig | null;
  nutritionStaples: NutritionStaple[];
  nutritionRegulars: NutritionRegular[];
  nutritionEntries: NutritionEntry[];
  streakActivities: StreakActivity[];
  streakLogCells: StreakLogCell[];
  streakActivityMeta: StreakActivityMeta[];
  waterConfig: WaterConfig | null;
  waterEntries: WaterEntry[];
  syncTombstones: SyncTombstone[];
}

export type UserDataTable = keyof UserData;
export type UserDataPatch = Partial<UserData>;
export type NutritionConfigDeleteKey = { id: 1 };
export type WaterConfigDeleteKey = { id: 1 };
export type FocusLogDeleteKey = Pick<FocusLogRow, 'id'>;
export type WorkoutLogDeleteKey = Pick<WorkoutLogRow, 'id'>;
export type AppKvDeleteKey = Pick<AppKvRow, 'key'>;
export type NutritionStapleDeleteKey = Pick<NutritionStaple, 'id'>;
export type NutritionRegularDeleteKey = Pick<NutritionRegular, 'id'>;
export type NutritionEntryDeleteKey = Pick<NutritionEntry, 'id'>;
export type StreakActivityDeleteKey = Pick<StreakActivity, 'id'>;
export type StreakLogCellDeleteKey = Pick<StreakLogCell, 'log_date' | 'activity_id'>;
export type StreakActivityMetaDeleteKey = Pick<StreakActivityMeta, 'activity_id'>;
export type WaterEntryDeleteKey = Pick<WaterEntry, 'id'>;
export type SyncTombstoneDeleteKey = Pick<SyncTombstone, 'entity' | 'row_key'>;

export interface UserDataRowPatch {
  focusLog?: { upserts?: FocusLogRow[]; deletes?: FocusLogDeleteKey[] };
  workoutLog?: { upserts?: WorkoutLogRow[]; deletes?: WorkoutLogDeleteKey[] };
  appKv?: { upserts?: AppKvRow[]; deletes?: AppKvDeleteKey[] };
  nutritionConfig?: { set?: NutritionConfig | null; deletes?: NutritionConfigDeleteKey[] };
  nutritionStaples?: { upserts?: NutritionStaple[]; deletes?: NutritionStapleDeleteKey[] };
  nutritionRegulars?: { upserts?: NutritionRegular[]; deletes?: NutritionRegularDeleteKey[] };
  nutritionEntries?: { upserts?: NutritionEntry[]; deletes?: NutritionEntryDeleteKey[] };
  streakActivities?: { upserts?: StreakActivity[]; deletes?: StreakActivityDeleteKey[] };
  streakLogCells?: { upserts?: StreakLogCell[]; deletes?: StreakLogCellDeleteKey[] };
  streakActivityMeta?: { upserts?: StreakActivityMeta[]; deletes?: StreakActivityMetaDeleteKey[] };
  waterConfig?: { set?: WaterConfig | null; deletes?: WaterConfigDeleteKey[] };
  waterEntries?: { upserts?: WaterEntry[]; deletes?: WaterEntryDeleteKey[] };
  syncTombstones?: { upserts?: SyncTombstone[]; deletes?: SyncTombstoneDeleteKey[] };
}

/**
 * Separator for composite tombstone row keys.
 * Must NOT be `\0`: sql.js (phone companion) treats embedded nulls as C-string terminators,
 * so keys like `2026-07-17\0jog` and `2026-07-17\0water` collide and hydrate throws UNIQUE.
 * Unit separator (U+001F) is safe in sql.js, better-sqlite3, and JSON.
 */
export const TOMBSTONE_KEY_SEP = '\x1f';

/** Stable tombstone key for composite row keys. */
export const tombstoneRowKey = (...parts: string[]): string => parts.join(TOMBSTONE_KEY_SEP);

/** Rewrite legacy null-byte separators so phone + server agree on the same key string. */
export const normalizeTombstoneRowKey = (rowKey: string): string =>
  rowKey.replace(/\0/g, TOMBSTONE_KEY_SEP);

export const normalizeSyncTombstones = (rows: SyncTombstone[] | undefined): SyncTombstone[] => {
  if (!rows?.length) return rows ?? [];
  const byKey = new Map<string, SyncTombstone>();
  for (const row of rows) {
    const normalized: SyncTombstone = {
      entity: row.entity,
      row_key: normalizeTombstoneRowKey(row.row_key),
      deleted_at: row.deleted_at
    };
    const k = `${normalized.entity}${TOMBSTONE_KEY_SEP}${normalized.row_key}`;
    const prev = byKey.get(k);
    if (!prev || Date.parse(normalized.deleted_at) >= Date.parse(prev.deleted_at)) byKey.set(k, normalized);
  }
  return [...byKey.values()];
};

export const USER_DATA_TABLES: UserDataTable[] = USER_DATA_TABLE_SCHEMAS.map((s) => s.field);

// ── Read all data from a local-schema db (no user_id columns) ─────────────────

export const extractUserData = async (db: SqlDatabase): Promise<UserData> => {
  const out = {} as UserData;
  for (const s of USER_DATA_TABLE_SCHEMAS) {
    const rows = await db.select(clientSelectSql(s));
    (out as Record<UserDataTable, UserData[UserDataTable]>)[s.field] = (
      s.singleton ? ((rows as unknown[])[0] ?? null) : rows
    ) as UserData[UserDataTable];
  }
  out.syncTombstones = normalizeSyncTombstones(out.syncTombstones);
  return out;
};

export const pickUserDataTables = (data: UserData, tables: UserDataTable[]): UserDataPatch => {
  const patch: UserDataPatch = {};
  for (const table of tables) (patch as Record<UserDataTable, UserData[UserDataTable]>)[table] = data[table];
  return patch;
};

export const extractUserDataForTables = async (db: SqlDatabase, tables: UserDataTable[]): Promise<UserDataPatch> => {
  const patch: UserDataPatch = {};
  for (const table of tables) {
    const s = schemaByField[table];
    const rows = await db.select(clientSelectSql(s));
    (patch as Record<UserDataTable, UserData[UserDataTable]>)[table] = (
      s.singleton ? ((rows as unknown[])[0] ?? null) : rows
    ) as UserData[UserDataTable];
  }
  if (patch.syncTombstones) patch.syncTombstones = normalizeSyncTombstones(patch.syncTombstones);
  return patch;
};

// ── Write a UserData snapshot into a local-schema db (replace tables to match snapshot) ──

/** Pull server data into local db unless that would wipe local rows with an empty server snapshot. */
export const hydrateDbFromServer = async (
  db: SqlDatabase,
  serverData: UserData,
  localData: UserData
): Promise<'hydrated' | 'kept-local'> => {
  if (!isUserDataEmpty(localData) && isUserDataEmpty(serverData)) {
    logSyncInfo('hydrate skipped: server snapshot empty but local has data', {
      local: summarizeUserDataCounts(localData)
    });
    return 'kept-local';
  }
  await hydrateDb(db, serverData);
  return 'hydrated';
};

/**
 * Replace local synced tables with a snapshot.
 * Safety:
 * - Runs under the data-sync write lock (no interleaved user writes) unless alreadyLocked.
 * - Uses the raw DB (not wrapWithDataSync) so full-table DELETE cannot enqueue outbox deletes.
 * - Entire rewrite is one SQLite transaction when BEGIN/COMMIT are supported.
 * - Never replaces a non-empty local table with an empty snapshot (accidental wipe guard).
 */
export const hydrateDb = async (
  db: SqlDatabase,
  data: UserData,
  opts?: { alreadyLocked?: boolean }
): Promise<void> => {
  const run = async () => {
    const raw = getRawSqlDatabase(db);
    await runWithoutDataSync(async () => {
      const normalized: UserData = {
        ...data,
        syncTombstones: normalizeSyncTombstones(data.syncTombstones)
      };
      const local = await extractUserData(raw);
      let began = false;
      try {
        await raw.execute('BEGIN');
        began = true;
      } catch {
        /* some test mocks / drivers reject BEGIN — still rewrite without a txn */
      }
      try {
        for (const s of USER_DATA_TABLE_SCHEMAS) {
          const incoming = s.getRows(normalized);
          const existing = s.getRows(local);
          let rowsToWrite = incoming;
          if (incoming.length === 0 && existing.length > 0) {
            logSyncInfo('hydrateDb kept local rows (refusing empty wipe)', {
              table: s.sqlTable,
              localRows: existing.length
            });
            rowsToWrite = existing;
          }
          await raw.execute(`DELETE FROM ${s.sqlTable}`);
          const sql = clientInsertSql(s);
          for (const row of rowsToWrite) {
            await raw.execute(sql, s.bind(row as never));
          }
        }
        if (began) await raw.execute('COMMIT');
      } catch (err) {
        if (began) {
          try { await raw.execute('ROLLBACK'); } catch { /* ignore */ }
        }
        throw err;
      }
    });
  };
  if (opts?.alreadyLocked) return run();
  return withDataSyncWriteLock(run);
};

// ── HTTP helpers ───────────────────────────────────────────────────────────────

const authHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
});

export const fetchUserData = async (baseUrl: string, token: string): Promise<UserData> => {
  const root = normalizeApiUrl(baseUrl);
  if (!root) throw new Error('fetchUserData: missing server URL');
  const url = `${root}/v1/data`;
  logSyncInfo('GET /v1/data', { url });
  let res: Response;
  try {
    res = await syncFetch(url, { headers: authHeaders(token) });
  } catch (err) {
    logSyncError('GET /v1/data network error', err, {
      url,
      hint: 'If the browser shows ERR_ADDRESS_UNREACHABLE, this device cannot route to the server host (DNS/VPS/firewall/Tailscale-only URL).'
    });
    const detail = err instanceof Error ? err.message : String(err);
    markSyncPullResult(false, detail);
    throw new Error(`fetchUserData: ${detail}`);
  }
  if (!res.ok) {
    await logSyncHttpFailure('GET', url, res);
    markSyncPullResult(false, `HTTP ${res.status}`);
    throw new Error(`fetchUserData: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { data: UserData };
  const data: UserData = {
    ...body.data,
    syncTombstones: normalizeSyncTombstones(body.data?.syncTombstones)
  };
  logSyncInfo('GET /v1/data ok', summarizeUserDataCounts(data));
  markSyncPullResult(true);
  return data;
};

export const pushUserData = async (
  baseUrl: string,
  token: string,
  data: UserData,
  opts?: { existingRowCount?: number }
): Promise<void> => {
  const root = normalizeApiUrl(baseUrl);
  if (!root) throw new Error('pushUserData: missing server URL');
  if (isUserDataEmpty(data)) {
    logSyncInfo('POST /v1/data skipped: empty snapshot');
    return;
  }
  if (opts?.existingRowCount != null) assertSafeSnapshotPush(data, opts.existingRowCount);
  const url = `${root}/v1/data`;
  logSyncInfo('POST /v1/data', { url, ...summarizeUserDataCounts(data) });
  let res: Response;
  try {
    res = await syncFetch(url, { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ data }) });
  } catch (err) {
    logSyncError('POST /v1/data network error', err, { url });
    const detail = err instanceof Error ? err.message : String(err);
    markSyncPushResult('push-full', false, detail);
    throw new Error(`pushUserData to ${url}: ${detail}`);
  }
  if (!res.ok) {
    await logSyncHttpFailure('POST', url, res);
    markSyncPushResult('push-full', false, `HTTP ${res.status}`);
    throw new Error(`pushUserData to ${url}: HTTP ${res.status}`);
  }
  logSyncInfo('POST /v1/data ok', { url });
  markSyncPushResult('push-full', true);
};

export const pushUserDataPatch = async (
  baseUrl: string,
  token: string,
  rowPatch: UserDataRowPatch
): Promise<void> => {
  const root = normalizeApiUrl(baseUrl);
  if (!root) throw new Error('pushUserDataPatch: missing server URL');
  const url = `${root}/v1/data/patch`;
  logSyncInfo('POST /v1/data/patch', { url, tables: Object.keys(rowPatch) });
  let res: Response;
  try {
    res = await syncFetch(url, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ rowPatch })
    });
  } catch (err) {
    logSyncError('POST /v1/data/patch network error', err, { url });
    const detail = err instanceof Error ? err.message : String(err);
    markSyncPushResult('push-patch', false, detail);
    throw new Error(`pushUserDataPatch to ${url}: ${detail}`);
  }
  if (!res.ok) {
    await logSyncHttpFailure('POST', url, res);
    markSyncPushResult('push-patch', false, `HTTP ${res.status}`);
    throw new Error(`pushUserDataPatch to ${url}: HTTP ${res.status}`);
  }
  logSyncInfo('POST /v1/data/patch ok', { url, tables: Object.keys(rowPatch) });
  markSyncPushResult('push-patch', true);
};

export const emptyUserData = (): UserData => ({
  focusLog: [],
  workoutLog: [],
  appKv: [],
  nutritionConfig: null,
  nutritionStaples: [],
  nutritionRegulars: [],
  nutritionEntries: [],
  streakActivities: [],
  streakLogCells: [],
  streakActivityMeta: [],
  waterConfig: null,
  waterEntries: [],
  syncTombstones: []
});

type EntityDeleteSpec = {
  entity: UserDataTable;
  deletes?: Array<Record<string, unknown>>;
  keyOf: (d: Record<string, unknown>) => string;
};

/** Attach tombstones for hard deletes so other devices can drop ghost rows on pull. */
export const enrichPatchWithTombstones = (
  rowPatch: UserDataRowPatch,
  deletedAt = new Date().toISOString()
): UserDataRowPatch => {
  const specs: EntityDeleteSpec[] = [
    { entity: 'focusLog', deletes: rowPatch.focusLog?.deletes as Array<Record<string, unknown>> | undefined, keyOf: (d) => String(d.id ?? '') },
    { entity: 'workoutLog', deletes: rowPatch.workoutLog?.deletes as Array<Record<string, unknown>> | undefined, keyOf: (d) => String(d.id ?? '') },
    { entity: 'appKv', deletes: rowPatch.appKv?.deletes as Array<Record<string, unknown>> | undefined, keyOf: (d) => String(d.key ?? '') },
    { entity: 'nutritionStaples', deletes: rowPatch.nutritionStaples?.deletes as Array<Record<string, unknown>> | undefined, keyOf: (d) => String(d.id ?? '') },
    { entity: 'nutritionRegulars', deletes: rowPatch.nutritionRegulars?.deletes as Array<Record<string, unknown>> | undefined, keyOf: (d) => String(d.id ?? '') },
    { entity: 'nutritionEntries', deletes: rowPatch.nutritionEntries?.deletes as Array<Record<string, unknown>> | undefined, keyOf: (d) => String(d.id ?? '') },
    { entity: 'streakActivities', deletes: rowPatch.streakActivities?.deletes as Array<Record<string, unknown>> | undefined, keyOf: (d) => String(d.id ?? '') },
    {
      entity: 'streakLogCells',
      deletes: rowPatch.streakLogCells?.deletes as Array<Record<string, unknown>> | undefined,
      keyOf: (d) => tombstoneRowKey(String(d.log_date ?? ''), String(d.activity_id ?? ''))
    },
    {
      entity: 'streakActivityMeta',
      deletes: rowPatch.streakActivityMeta?.deletes as Array<Record<string, unknown>> | undefined,
      keyOf: (d) => String(d.activity_id ?? '')
    },
    { entity: 'waterEntries', deletes: rowPatch.waterEntries?.deletes as Array<Record<string, unknown>> | undefined, keyOf: (d) => String(d.id ?? '') }
  ];
  const upserts: SyncTombstone[] = normalizeSyncTombstones(rowPatch.syncTombstones?.upserts);
  const seen = new Set(upserts.map((t) => `${t.entity}${TOMBSTONE_KEY_SEP}${t.row_key}`));
  for (const spec of specs) {
    for (const del of spec.deletes ?? []) {
      const row_key = spec.keyOf(del);
      if (!row_key) continue;
      const k = `${spec.entity}${TOMBSTONE_KEY_SEP}${row_key}`;
      if (seen.has(k)) continue;
      seen.add(k);
      upserts.push({ entity: spec.entity, row_key, deleted_at: deletedAt });
    }
  }
  // Recreated rows with updated_at > tombstone.deleted_at survive merge without clearing the tombstone.
  if (!upserts.length) return rowPatch;
  return {
    ...rowPatch,
    syncTombstones: {
      upserts,
      deletes: rowPatch.syncTombstones?.deletes
    }
  };
};

/** Push only rows that differ between two snapshots (normal sync path; not full replace). */
export const pushUserDataDiff = async (
  baseUrl: string,
  token: string,
  before: UserData,
  after: UserData
): Promise<void> => {
  const rowPatch = buildUserDataRowPatch(before, after, USER_DATA_TABLES);
  if (!hasUserDataRowPatchChanges(rowPatch)) return;
  await pushUserDataPatch(baseUrl, token, rowPatch);
};

const stableString = (value: unknown): string => JSON.stringify(value);

const diffRows = <T>(
  beforeRows: T[],
  afterRows: T[],
  keyOf: (row: T) => string,
  deleteOf: (row: T) => unknown
): { upserts: T[]; deletes: unknown[] } => {
  const beforeMap = new Map<string, T>();
  const afterMap = new Map<string, T>();
  for (const row of beforeRows) beforeMap.set(keyOf(row), row);
  for (const row of afterRows) afterMap.set(keyOf(row), row);
  const upserts: T[] = [];
  const deletes: unknown[] = [];
  for (const [key, row] of afterMap) {
    const before = beforeMap.get(key);
    if (!before || stableString(before) !== stableString(row)) upserts.push(row);
  }
  for (const [key, row] of beforeMap) {
    if (!afterMap.has(key)) deletes.push(deleteOf(row));
  }
  return { upserts, deletes };
};

export const buildUserDataRowPatch = (
  before: UserDataPatch,
  after: UserDataPatch,
  tables: UserDataTable[]
): UserDataRowPatch => {
  const rowPatch: UserDataRowPatch = {};
  for (const table of tables) {
    if (table === 'nutritionConfig') {
      if (stableString(before.nutritionConfig ?? null) !== stableString(after.nutritionConfig ?? null)) {
        rowPatch.nutritionConfig = { set: after.nutritionConfig ?? null };
      }
      continue;
    }
    if (table === 'waterConfig') {
      if (stableString(before.waterConfig ?? null) !== stableString(after.waterConfig ?? null)) {
        rowPatch.waterConfig = { set: after.waterConfig ?? null };
      }
      continue;
    }
    if (table === 'focusLog') {
      const { upserts, deletes } = diffRows(before.focusLog ?? [], after.focusLog ?? [], (r) => r.id, (r) => ({ id: r.id }));
      if (upserts.length || deletes.length) rowPatch.focusLog = { upserts, deletes: deletes as FocusLogDeleteKey[] };
      continue;
    }
    if (table === 'workoutLog') {
      const { upserts, deletes } = diffRows(before.workoutLog ?? [], after.workoutLog ?? [], (r) => r.id, (r) => ({ id: r.id }));
      if (upserts.length || deletes.length) rowPatch.workoutLog = { upserts, deletes: deletes as WorkoutLogDeleteKey[] };
      continue;
    }
    if (table === 'appKv') {
      const { upserts, deletes } = diffRows(before.appKv ?? [], after.appKv ?? [], (r) => r.key, (r) => ({ key: r.key }));
      if (upserts.length || deletes.length) rowPatch.appKv = { upserts, deletes: deletes as AppKvDeleteKey[] };
      continue;
    }
    if (table === 'nutritionStaples') {
      const { upserts, deletes } = diffRows(before.nutritionStaples ?? [], after.nutritionStaples ?? [], (r) => r.id, (r) => ({ id: r.id }));
      if (upserts.length || deletes.length) rowPatch.nutritionStaples = { upserts, deletes: deletes as NutritionStapleDeleteKey[] };
      continue;
    }
    if (table === 'nutritionRegulars') {
      const { upserts, deletes } = diffRows(before.nutritionRegulars ?? [], after.nutritionRegulars ?? [], (r) => r.id, (r) => ({ id: r.id }));
      if (upserts.length || deletes.length) rowPatch.nutritionRegulars = { upserts, deletes: deletes as NutritionRegularDeleteKey[] };
      continue;
    }
    if (table === 'nutritionEntries') {
      const { upserts, deletes } = diffRows(before.nutritionEntries ?? [], after.nutritionEntries ?? [], (r) => r.id, (r) => ({ id: r.id }));
      if (upserts.length || deletes.length) rowPatch.nutritionEntries = { upserts, deletes: deletes as NutritionEntryDeleteKey[] };
      continue;
    }
    if (table === 'streakActivities') {
      const { upserts, deletes } = diffRows(before.streakActivities ?? [], after.streakActivities ?? [], (r) => r.id, (r) => ({ id: r.id }));
      if (upserts.length || deletes.length) rowPatch.streakActivities = { upserts, deletes: deletes as StreakActivityDeleteKey[] };
      continue;
    }
    if (table === 'streakLogCells') {
      const { upserts, deletes } = diffRows(
        before.streakLogCells ?? [],
        after.streakLogCells ?? [],
        (r) => `${r.log_date}\0${r.activity_id}`,
        (r) => ({ log_date: r.log_date, activity_id: r.activity_id })
      );
      if (upserts.length || deletes.length) rowPatch.streakLogCells = { upserts, deletes: deletes as StreakLogCellDeleteKey[] };
      continue;
    }
    if (table === 'streakActivityMeta') {
      const { upserts, deletes } = diffRows(before.streakActivityMeta ?? [], after.streakActivityMeta ?? [], (r) => r.activity_id, (r) => ({ activity_id: r.activity_id }));
      if (upserts.length || deletes.length) rowPatch.streakActivityMeta = { upserts, deletes: deletes as StreakActivityMetaDeleteKey[] };
      continue;
    }
    if (table === 'waterEntries') {
      const { upserts, deletes } = diffRows(before.waterEntries ?? [], after.waterEntries ?? [], (r) => r.id, (r) => ({ id: r.id }));
      if (upserts.length || deletes.length) rowPatch.waterEntries = { upserts, deletes: deletes as WaterEntryDeleteKey[] };
      continue;
    }
    if (table === 'syncTombstones') {
      const { upserts, deletes } = diffRows(
        normalizeSyncTombstones(before.syncTombstones),
        normalizeSyncTombstones(after.syncTombstones),
        (r) => `${r.entity}${TOMBSTONE_KEY_SEP}${r.row_key}`,
        (r) => ({ entity: r.entity, row_key: r.row_key })
      );
      if (upserts.length || deletes.length) {
        rowPatch.syncTombstones = { upserts, deletes: deletes as SyncTombstoneDeleteKey[] };
      }
    }
  }
  return enrichPatchWithTombstones(rowPatch);
};

export const hasUserDataRowPatchChanges = (rowPatch: UserDataRowPatch): boolean =>
  Object.keys(rowPatch).length > 0;

const isMutationQuery = (query: string): boolean =>
  /^\s*(insert|update|delete|replace)\b/i.test(query);

// ── Sync-aware db wrapper ──────────────────────────────────────────────────────
// Wraps any SqlDatabase so that writes trigger a debounced push to the server.
// If serverUrl/token are not provided the wrapper is a pass-through.

export type SyncCreds = { serverUrl?: string; token?: string };
export type SyncCredsProvider = () => SyncCreds | Promise<SyncCreds>;

/** Nestable: while > 0, wrapWithDataSync execute is pass-through (no outbox). Used by hydrateDb. */
let dataSyncSuppressDepth = 0;

/** Bumped when a suppress window ends so debounced pushes can drop stale before-snapshots. */
let dataSyncSuppressGeneration = 0;

export const runWithoutDataSync = async <T>(fn: () => Promise<T>): Promise<T> => {
  dataSyncSuppressDepth += 1;
  try {
    return await fn();
  } finally {
    dataSyncSuppressDepth -= 1;
    if (dataSyncSuppressDepth === 0) dataSyncSuppressGeneration += 1;
  }
};

/** Wait until hydrateDb / runWithoutDataSync is not rewriting tables (poll; works with fake timers). */
export const waitWhileDataSyncSuppressed = async (pollMs = 25): Promise<void> => {
  while (dataSyncSuppressDepth > 0) {
    await new Promise<void>((resolve) => { setTimeout(resolve, pollMs); });
  }
};

export const wrapWithDataSync = (
  db: SqlDatabase,
  getCreds: SyncCredsProvider,
  debounceMs = 2000,
  onPushError?: (err: unknown) => void,
  beforePush?: () => void | Promise<void>
): SqlDatabase => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let skippedUnknownMutation = false;
  const dirtyTables = new Set<UserDataTable>();
  const beforeMutationSnapshot: UserDataPatch = {};

  const scheduleSync = () => {
    if (dataSyncSuppressDepth > 0) return;
    if (timer) clearTimeout(timer);
    const genAtSchedule = dataSyncSuppressGeneration;
    timer = setTimeout(() => {
      timer = null;
      void Promise.resolve(getCreds()).then(async ({ serverUrl, token }) => {
        if (!serverUrl || !token) return;
        if (beforePush) await beforePush();
        // Never diff against a mid-hydrate torn table (that minted mass false tombstones).
        await waitWhileDataSyncSuppressed();
        const tables = [...dirtyTables];
        if (skippedUnknownMutation) {
          logSyncInfo('sync skipped unknown mutation SQL; use markSyncRowPatch for explicit patches');
          skippedUnknownMutation = false;
        }
        if (tables.length === 0) {
          await drainSyncOutbox(db, serverUrl, token);
          return;
        }
        // Hydrate finished after we captured "before" — that snapshot is stale; upsert only.
        if (dataSyncSuppressGeneration !== genAtSchedule) {
          for (const table of tables) delete beforeMutationSnapshot[table];
          logSyncInfo('sync discarded before snapshot after hydrate', { tables });
        }
        const afterMutation = await extractUserDataForTables(db, tables);
        const missingBefore = tables.filter((table) => !(table in beforeMutationSnapshot));
        if (missingBefore.length > 0) {
          logSyncInfo('sync patch missing before snapshot; upserting current rows only', { tables: missingBefore });
          const upsertPatch = buildUserDataRowPatch({}, afterMutation, missingBefore);
          await enqueueSyncPatch(db, upsertPatch);
        }
        const knownTables = tables.filter((table) => table in beforeMutationSnapshot);
        if (knownTables.length > 0) {
          const beforeMutation = pickUserDataTables(beforeMutationSnapshot as UserData, knownTables);
          const knownAfter = pickUserDataTables(afterMutation as UserData, knownTables);
          const rowPatch = buildUserDataRowPatch(beforeMutation, knownAfter, knownTables);
          await enqueueSyncPatch(db, rowPatch);
        }
        for (const table of tables) {
          dirtyTables.delete(table);
          delete beforeMutationSnapshot[table];
        }
        const drain = await drainSyncOutbox(db, serverUrl, token);
        if (!drain.ok) throw new Error('sync outbox drain failed');
      }).catch((err) => {
        logSyncError('debounced push failed', err);
        onPushError?.(err);
      });
    }, debounceMs);
  };
  const wrapped: SqlDatabase = {
    select: (q, bind) => db.select(q, bind),
    execute: async (q, bind) => {
      // Queue behind hydrate / other writers so a check cannot land mid wipe-and-refill.
      return withDataSyncWriteLock(async () => {
        if (dataSyncSuppressDepth > 0) return db.execute(q, bind);
        const touchedTables = inferSyncUserDataTablesFromSql(q);
        const mutation = isMutationQuery(q);
        if (mutation && touchedTables.length > 0) {
          const missingTables = touchedTables.filter((table) => !(table in beforeMutationSnapshot));
          if (missingTables.length > 0) {
            const preMutation = await extractUserDataForTables(db, missingTables);
            Object.assign(beforeMutationSnapshot, preMutation);
          }
        }
        const result = await db.execute(q, bind);
        if (mutation && touchedTables.length === 0) skippedUnknownMutation = true;
        for (const table of touchedTables) dirtyTables.add(table);
        if (mutation) markLocalSyncChangePending();
        scheduleSync();
        return result;
      });
    }
  };
  rawSqlDatabases.set(wrapped, db);
  return wrapped;
};
