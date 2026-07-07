import type { SqlDatabase } from '@mgmt/storage';
import { normalizeApiUrl } from './apiUrl';
import { logSyncError, logSyncHttpFailure, logSyncInfo, summarizeUserDataCounts } from './syncLog';
import { syncFetch } from './syncFetch';
import { assertSafeSnapshotPush, isUserDataEmpty } from './userDataSafety';

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
export interface NutritionConfig { tdee: number; protein: number; log_day: string; }
export interface NutritionStaple {
  id: string; name: string; calories: number; protein: number;
  ingredients_json: string | null; sort_order: number;
}
export interface NutritionRegular {
  id: string; name: string; calories: number; protein: number;
  ingredients_json: string | null; sort_order: number;
}
export interface NutritionEntry {
  id: string; log_day: string; kind: string; ref_id: string | null;
  label: string; calories: number; protein: number; count: number;
  updated_at: string; deleted: number;
}
export interface WaterConfig { target_ml: number; log_day: string; }
export interface WaterEntry {
  id: string; log_day: string; label: string; ml: number;
  count: number; updated_at: string; deleted: number;
}
export interface StreakActivity {
  id: string; name: string; description: string | null; frequency: string;
  weekly_target: number | null; scheduled_days_json: string | null;
  can_fail: number; archived_at: string | null; sort_order: number;
  extra_calories: number | null; extra_protein: number | null; extra_water_ml: number | null;
}
export interface StreakLogCell { log_date: string; activity_id: string; state: string; updated_at: string; }
export interface StreakActivityMeta {
  activity_id: string; start_date: string | null; pause_since: string | null;
  unpaused_at: string | null; reset_count: number;
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
}

export const USER_DATA_TABLES: UserDataTable[] = [
  'focusLog',
  'workoutLog',
  'appKv',
  'nutritionConfig',
  'nutritionStaples',
  'nutritionRegulars',
  'nutritionEntries',
  'streakActivities',
  'streakLogCells',
  'streakActivityMeta',
  'waterConfig',
  'waterEntries'
];

const streakSelect = 'SELECT id,name,description,frequency,weekly_target,scheduled_days_json,can_fail,archived_at,sort_order,extra_calories,extra_protein,extra_water_ml FROM streak_activities ORDER BY sort_order';
const SELECT_BY_TABLE: Record<UserDataTable, string> = {
  focusLog: 'SELECT id,session_type,completed_at,duration_minutes,planned_duration_minutes,completion_ratio FROM focus_log ORDER BY completed_at DESC',
  workoutLog: 'SELECT id,workout_id,workout_name,completed_at,exercises_json,total_reps,total_timed_seconds,completion_ratio FROM workout_log ORDER BY completed_at DESC',
  appKv: 'SELECT key,value,updated_at FROM app_kv',
  nutritionConfig: 'SELECT tdee,protein,log_day FROM nutrition_config WHERE id=1',
  nutritionStaples: 'SELECT id,name,calories,protein,ingredients_json,sort_order FROM nutrition_staples ORDER BY sort_order',
  nutritionRegulars: 'SELECT id,name,calories,protein,ingredients_json,sort_order FROM nutrition_regulars ORDER BY sort_order',
  nutritionEntries: 'SELECT id,log_day,kind,ref_id,label,calories,protein,count,updated_at,deleted FROM nutrition_entries',
  streakActivities: streakSelect,
  streakLogCells: 'SELECT log_date,activity_id,state,updated_at FROM streak_log_cells',
  streakActivityMeta: 'SELECT activity_id,start_date,pause_since,unpaused_at,reset_count FROM streak_activity_meta',
  waterConfig: 'SELECT target_ml,log_day FROM water_config WHERE id=1',
  waterEntries: 'SELECT id,log_day,label,ml,count,updated_at,deleted FROM water_entries'
};

// ── Read all data from a local-schema db (no user_id columns) ─────────────────

export const extractUserData = async (db: SqlDatabase): Promise<UserData> => ({
  focusLog: await db.select(SELECT_BY_TABLE.focusLog),
  workoutLog: await db.select(SELECT_BY_TABLE.workoutLog),
  appKv: await db.select(SELECT_BY_TABLE.appKv),
  nutritionConfig: await db.select<NutritionConfig[]>(SELECT_BY_TABLE.nutritionConfig).then((r) => r[0] ?? null),
  nutritionStaples: await db.select(SELECT_BY_TABLE.nutritionStaples),
  nutritionRegulars: await db.select(SELECT_BY_TABLE.nutritionRegulars),
  nutritionEntries: await db.select(SELECT_BY_TABLE.nutritionEntries),
  streakActivities: await db.select(SELECT_BY_TABLE.streakActivities),
  streakLogCells: await db.select(SELECT_BY_TABLE.streakLogCells),
  streakActivityMeta: await db.select(SELECT_BY_TABLE.streakActivityMeta),
  waterConfig: await db.select<WaterConfig[]>(SELECT_BY_TABLE.waterConfig).then((r) => r[0] ?? null),
  waterEntries: await db.select(SELECT_BY_TABLE.waterEntries),
});

export const pickUserDataTables = (data: UserData, tables: UserDataTable[]): UserDataPatch => {
  const patch: UserDataPatch = {};
  for (const table of tables) patch[table] = data[table];
  return patch;
};

export const extractUserDataForTables = async (db: SqlDatabase, tables: UserDataTable[]): Promise<UserDataPatch> => {
  const patch: UserDataPatch = {};
  for (const table of tables) {
    const rows = await db.select(SELECT_BY_TABLE[table]);
    patch[table] = (table === 'nutritionConfig' || table === 'waterConfig')
      ? ((rows as NutritionConfig[] | WaterConfig[])[0] ?? null)
      : rows as UserData[typeof table];
  }
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

export const hydrateDb = async (db: SqlDatabase, data: UserData): Promise<void> => {
  await db.execute('DELETE FROM focus_log');
  await db.execute('DELETE FROM workout_log');
  await db.execute('DELETE FROM app_kv');
  await db.execute('DELETE FROM nutrition_config');
  await db.execute('DELETE FROM nutrition_staples');
  await db.execute('DELETE FROM nutrition_regulars');
  await db.execute('DELETE FROM nutrition_entries');
  await db.execute('DELETE FROM streak_activities');
  await db.execute('DELETE FROM streak_log_cells');
  await db.execute('DELETE FROM streak_activity_meta');
  await db.execute('DELETE FROM water_config');
  await db.execute('DELETE FROM water_entries');

  for (const r of data.focusLog) {
    await db.execute(
      'INSERT INTO focus_log (id,session_type,completed_at,duration_minutes,planned_duration_minutes,completion_ratio) VALUES (?,?,?,?,?,?)',
      [r.id, r.session_type, r.completed_at, r.duration_minutes, r.planned_duration_minutes ?? null, r.completion_ratio ?? null]
    );
  }
  for (const r of data.workoutLog) {
    await db.execute(
      'INSERT INTO workout_log (id,workout_id,workout_name,completed_at,exercises_json,total_reps,total_timed_seconds,completion_ratio) VALUES (?,?,?,?,?,?,?,?)',
      [r.id, r.workout_id, r.workout_name, r.completed_at, r.exercises_json, r.total_reps, r.total_timed_seconds, r.completion_ratio ?? null]
    );
  }
  for (const r of data.appKv) {
    await db.execute(
      'INSERT INTO app_kv (key,value,updated_at) VALUES (?,?,?)',
      [r.key, r.value, r.updated_at]
    );
  }
  if (data.nutritionConfig) {
    const nc = data.nutritionConfig;
    await db.execute(
      'INSERT OR REPLACE INTO nutrition_config (id,tdee,protein,log_day) VALUES (1,?,?,?)',
      [nc.tdee, nc.protein, nc.log_day]
    );
  }
  for (const r of data.nutritionStaples) {
    await db.execute(
      'INSERT INTO nutrition_staples (id,name,calories,protein,ingredients_json,sort_order) VALUES (?,?,?,?,?,?)',
      [r.id, r.name, r.calories, r.protein, r.ingredients_json ?? null, r.sort_order]
    );
  }
  for (const r of data.nutritionRegulars) {
    await db.execute(
      'INSERT INTO nutrition_regulars (id,name,calories,protein,ingredients_json,sort_order) VALUES (?,?,?,?,?,?)',
      [r.id, r.name, r.calories, r.protein, r.ingredients_json ?? null, r.sort_order]
    );
  }
  for (const r of data.nutritionEntries) {
    await db.execute(
      'INSERT INTO nutrition_entries (id,log_day,kind,ref_id,label,calories,protein,count,updated_at,deleted) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [r.id, r.log_day, r.kind, r.ref_id ?? null, r.label, r.calories, r.protein, r.count, r.updated_at, r.deleted]
    );
  }
  for (const r of data.streakActivities) {
    await db.execute(
      'INSERT INTO streak_activities (id,name,description,frequency,weekly_target,scheduled_days_json,can_fail,archived_at,sort_order,extra_calories,extra_protein,extra_water_ml) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [r.id, r.name, r.description ?? null, r.frequency, r.weekly_target ?? null, r.scheduled_days_json ?? null, r.can_fail, r.archived_at ?? null, r.sort_order, r.extra_calories ?? null, r.extra_protein ?? null, r.extra_water_ml ?? null]
    );
  }
  for (const r of data.streakLogCells) {
    await db.execute(
      'INSERT INTO streak_log_cells (log_date,activity_id,state,updated_at) VALUES (?,?,?,?)',
      [r.log_date, r.activity_id, r.state, r.updated_at]
    );
  }
  for (const r of data.streakActivityMeta) {
    await db.execute(
      'INSERT INTO streak_activity_meta (activity_id,start_date,pause_since,unpaused_at,reset_count) VALUES (?,?,?,?,?)',
      [r.activity_id, r.start_date ?? null, r.pause_since ?? null, r.unpaused_at ?? null, r.reset_count]
    );
  }
  const waterEntries = data.waterEntries ?? [];
  if (data.waterConfig) {
    const wc = data.waterConfig;
    await db.execute(
      'INSERT OR REPLACE INTO water_config (id,target_ml,log_day) VALUES (1,?,?)',
      [wc.target_ml, wc.log_day]
    );
  }
  for (const r of waterEntries) {
    await db.execute(
      'INSERT INTO water_entries (id,log_day,label,ml,count,updated_at,deleted) VALUES (?,?,?,?,?,?,?)',
      [r.id, r.log_day, r.label, r.ml, r.count, r.updated_at, r.deleted]
    );
  }
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
    throw new Error(`fetchUserData: ${detail}`);
  }
  if (!res.ok) {
    await logSyncHttpFailure('GET', url, res);
    throw new Error(`fetchUserData: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { data: UserData };
  logSyncInfo('GET /v1/data ok', summarizeUserDataCounts(body.data));
  return body.data;
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
    throw new Error(`pushUserData to ${url}: ${detail}`);
  }
  if (!res.ok) {
    await logSyncHttpFailure('POST', url, res);
    throw new Error(`pushUserData to ${url}: HTTP ${res.status}`);
  }
  logSyncInfo('POST /v1/data ok', { url });
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
    throw new Error(`pushUserDataPatch to ${url}: ${detail}`);
  }
  if (!res.ok) {
    await logSyncHttpFailure('POST', url, res);
    throw new Error(`pushUserDataPatch to ${url}: HTTP ${res.status}`);
  }
  logSyncInfo('POST /v1/data/patch ok', { url, tables: Object.keys(rowPatch) });
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
    }
  }
  return rowPatch;
};

export const hasUserDataRowPatchChanges = (rowPatch: UserDataRowPatch): boolean =>
  Object.keys(rowPatch).length > 0;

const QUERY_TO_USER_DATA_TABLE: Array<{ pattern: RegExp; table: UserDataTable }> = [
  { pattern: /\bfocus_log\b/i, table: 'focusLog' },
  { pattern: /\bworkout_log\b/i, table: 'workoutLog' },
  { pattern: /\bapp_kv\b/i, table: 'appKv' },
  { pattern: /\bnutrition_config\b/i, table: 'nutritionConfig' },
  { pattern: /\bnutrition_staples\b/i, table: 'nutritionStaples' },
  { pattern: /\bnutrition_regulars\b/i, table: 'nutritionRegulars' },
  { pattern: /\bnutrition_entries\b/i, table: 'nutritionEntries' },
  { pattern: /\bstreak_activities\b/i, table: 'streakActivities' },
  { pattern: /\bstreak_log_cells\b/i, table: 'streakLogCells' },
  { pattern: /\bstreak_activity_meta\b/i, table: 'streakActivityMeta' },
  { pattern: /\bwater_config\b/i, table: 'waterConfig' },
  { pattern: /\bwater_entries\b/i, table: 'waterEntries' }
];

const isMutationQuery = (query: string): boolean =>
  /^\s*(insert|update|delete|replace)\b/i.test(query);

const inferTouchedUserDataTables = (query: string): UserDataTable[] => {
  if (!isMutationQuery(query)) return [];
  const tables: UserDataTable[] = [];
  for (const entry of QUERY_TO_USER_DATA_TABLE) {
    if (entry.pattern.test(query)) tables.push(entry.table);
  }
  return tables;
};

// ── Sync-aware db wrapper ──────────────────────────────────────────────────────
// Wraps any SqlDatabase so that writes trigger a debounced push to the server.
// If serverUrl/token are not provided the wrapper is a pass-through.

export type SyncCreds = { serverUrl?: string; token?: string };
export type SyncCredsProvider = () => SyncCreds | Promise<SyncCreds>;

export const wrapWithDataSync = (
  db: SqlDatabase,
  getCreds: SyncCredsProvider,
  debounceMs = 2000,
  onPushError?: (err: unknown) => void,
  beforePush?: () => void | Promise<void>
): SqlDatabase => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hadUnknownMutation = false;
  const dirtyTables = new Set<UserDataTable>();
  const beforeMutationSnapshot: UserDataPatch = {};

  const scheduleSync = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void Promise.resolve(getCreds()).then(async ({ serverUrl, token }) => {
        if (!serverUrl || !token) return;
        const tables = [...dirtyTables];
        if (!hadUnknownMutation && tables.length === 0) return;
        const shouldFullPush = hadUnknownMutation;
        if (beforePush) await beforePush();
        if (shouldFullPush) {
          const data = await extractUserData(db);
          if (isUserDataEmpty(data)) return;
          await pushUserData(serverUrl, token, data);
          hadUnknownMutation = false;
          dirtyTables.clear();
          for (const table of USER_DATA_TABLES) delete beforeMutationSnapshot[table];
          return;
        }
        const afterMutation = await extractUserDataForTables(db, tables);
        const missingBefore = tables.filter((table) => !(table in beforeMutationSnapshot));
        if (missingBefore.length > 0) {
          const fullData = await extractUserData(db);
          if (isUserDataEmpty(fullData)) return;
          await pushUserData(serverUrl, token, fullData);
          dirtyTables.clear();
          for (const table of USER_DATA_TABLES) delete beforeMutationSnapshot[table];
          return;
        }
        const beforeMutation = pickUserDataTables(beforeMutationSnapshot as UserData, tables);
        const rowPatch = buildUserDataRowPatch(beforeMutation, afterMutation, tables);
        if (!hasUserDataRowPatchChanges(rowPatch)) {
          for (const table of tables) {
            dirtyTables.delete(table);
            delete beforeMutationSnapshot[table];
          }
          return;
        }
        await pushUserDataPatch(serverUrl, token, rowPatch);
        for (const table of tables) {
          dirtyTables.delete(table);
          delete beforeMutationSnapshot[table];
        }
      }).catch((err) => {
        logSyncError('debounced push failed', err);
        onPushError?.(err);
      });
    }, debounceMs);
  };
  return {
    select: (q, bind) => db.select(q, bind),
    execute: async (q, bind) => {
      const touchedTables = inferTouchedUserDataTables(q);
      const mutation = isMutationQuery(q);
      if (mutation && touchedTables.length > 0 && !hadUnknownMutation) {
        const missingTables = touchedTables.filter((table) => !(table in beforeMutationSnapshot));
        if (missingTables.length > 0) {
          const preMutation = await extractUserDataForTables(db, missingTables);
          Object.assign(beforeMutationSnapshot, preMutation);
        }
      }
      const result = await db.execute(q, bind);
      if (mutation && touchedTables.length === 0) hadUnknownMutation = true;
      for (const table of touchedTables) dirtyTables.add(table);
      scheduleSync();
      return result;
    }
  };
};
