import type { SqlDatabase } from '@mgmt/storage';
import { hasUserDataRowPatchChanges, pushUserDataPatch, type UserDataRowPatch, TOMBSTONE_KEY_SEP } from './userData';
import { logSyncError, logSyncInfo } from './syncLog';
import { sanitizeDangerousBulkDeletes } from './syncPatchSafety';
import { markSyncPushResult } from './syncStatus';

type OutboxRow = { id: number; patch_json: string; created_at: number };

const parseTs = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v) || 0;
  return 0;
};

/** Prefer the row with the newer updated_at / deleted_at clock (not mere queue order). */
const mergeUpserts = <T>(
  left: T[] = [],
  right: T[] = [],
  keyFn: (row: T) => string,
  clock: (row: T) => number = (row) => {
    const r = row as { updated_at?: unknown; deleted_at?: unknown };
    return parseTs(r.updated_at ?? r.deleted_at);
  }
): T[] => {
  const map = new Map<string, T>();
  for (const row of [...left, ...right]) {
    const key = keyFn(row);
    const existing = map.get(key);
    if (!existing || clock(row) >= clock(existing)) map.set(key, row);
  }
  return [...map.values()];
};

const mergeDeletes = <T>(left: T[] = [], right: T[] = []): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of [...left, ...right]) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
};

/** Combine queued patches; same-key upserts keep the newer clock (not FIFO-last). */
export const mergeUserDataRowPatches = (left: UserDataRowPatch, right: UserDataRowPatch): UserDataRowPatch => {
  const merged: UserDataRowPatch = { ...left };
  if (right.focusLog) {
    merged.focusLog = {
      upserts: mergeUpserts(merged.focusLog?.upserts, right.focusLog.upserts, (r) => r.id, (r) => parseTs(r.completed_at)),
      deletes: mergeDeletes(merged.focusLog?.deletes, right.focusLog.deletes)
    };
  }
  if (right.workoutLog) {
    merged.workoutLog = {
      upserts: mergeUpserts(merged.workoutLog?.upserts, right.workoutLog.upserts, (r) => r.id, (r) => parseTs(r.completed_at)),
      deletes: mergeDeletes(merged.workoutLog?.deletes, right.workoutLog.deletes)
    };
  }
  if (right.appKv) {
    merged.appKv = {
      upserts: mergeUpserts(merged.appKv?.upserts, right.appKv.upserts, (r) => r.key),
      deletes: mergeDeletes(merged.appKv?.deletes, right.appKv.deletes)
    };
  }
  if (right.nutritionConfig) merged.nutritionConfig = { ...merged.nutritionConfig, ...right.nutritionConfig };
  if (right.nutritionStaples) {
    merged.nutritionStaples = {
      upserts: mergeUpserts(merged.nutritionStaples?.upserts, right.nutritionStaples.upserts, (r) => r.id),
      deletes: mergeDeletes(merged.nutritionStaples?.deletes, right.nutritionStaples.deletes)
    };
  }
  if (right.nutritionRegulars) {
    merged.nutritionRegulars = {
      upserts: mergeUpserts(merged.nutritionRegulars?.upserts, right.nutritionRegulars.upserts, (r) => r.id),
      deletes: mergeDeletes(merged.nutritionRegulars?.deletes, right.nutritionRegulars.deletes)
    };
  }
  if (right.nutritionEntries) {
    merged.nutritionEntries = {
      upserts: mergeUpserts(merged.nutritionEntries?.upserts, right.nutritionEntries.upserts, (r) => `${r.id}\0${r.log_day}`),
      deletes: mergeDeletes(merged.nutritionEntries?.deletes, right.nutritionEntries.deletes)
    };
  }
  if (right.streakActivities) {
    merged.streakActivities = {
      upserts: mergeUpserts(merged.streakActivities?.upserts, right.streakActivities.upserts, (r) => r.id),
      deletes: mergeDeletes(merged.streakActivities?.deletes, right.streakActivities.deletes)
    };
  }
  if (right.streakLogCells) {
    merged.streakLogCells = {
      upserts: mergeUpserts(merged.streakLogCells?.upserts, right.streakLogCells.upserts, (r) => `${r.log_date}\0${r.activity_id}`),
      deletes: mergeDeletes(merged.streakLogCells?.deletes, right.streakLogCells.deletes)
    };
  }
  if (right.streakActivityMeta) {
    merged.streakActivityMeta = {
      upserts: mergeUpserts(merged.streakActivityMeta?.upserts, right.streakActivityMeta.upserts, (r) => r.activity_id),
      deletes: mergeDeletes(merged.streakActivityMeta?.deletes, right.streakActivityMeta.deletes)
    };
  }
  if (right.waterConfig) merged.waterConfig = { ...merged.waterConfig, ...right.waterConfig };
  if (right.waterEntries) {
    merged.waterEntries = {
      upserts: mergeUpserts(merged.waterEntries?.upserts, right.waterEntries.upserts, (r) => `${r.id}\0${r.log_day}`),
      deletes: mergeDeletes(merged.waterEntries?.deletes, right.waterEntries.deletes)
    };
  }
  if (right.syncTombstones) {
    merged.syncTombstones = {
      upserts: mergeUpserts(
        merged.syncTombstones?.upserts,
        right.syncTombstones.upserts,
        (r) => `${r.entity}${TOMBSTONE_KEY_SEP}${r.row_key}`,
        (r) => parseTs(r.deleted_at)
      ),
      deletes: mergeDeletes(merged.syncTombstones?.deletes, right.syncTombstones.deletes)
    };
  }
  return merged;
};

export const readSyncOutbox = async (db: SqlDatabase): Promise<OutboxRow[]> =>
  db.select<OutboxRow[]>('SELECT id,patch_json,created_at FROM sync_outbox ORDER BY id');

export const enqueueSyncPatch = async (db: SqlDatabase, patch: UserDataRowPatch): Promise<void> => {
  const safe = sanitizeDangerousBulkDeletes(patch);
  if (!hasUserDataRowPatchChanges(safe)) return;
  await db.execute(
    'INSERT INTO sync_outbox (patch_json, created_at) VALUES ($1, $2)',
    [JSON.stringify(safe), Date.now()]
  );
};

export const clearSyncOutboxIds = async (db: SqlDatabase, ids: number[]): Promise<void> => {
  if (!ids.length) return;
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  await db.execute(`DELETE FROM sync_outbox WHERE id IN (${placeholders})`, ids);
};

export const drainSyncOutbox = async (
  db: SqlDatabase,
  serverUrl: string,
  token: string
): Promise<{ ok: boolean; drained: number }> => {
  const rows = (await readSyncOutbox(db)) ?? [];
  if (!rows.length) return { ok: true, drained: 0 };
  let combined: UserDataRowPatch = {};
  for (const row of rows) {
    try {
      combined = mergeUserDataRowPatches(combined, JSON.parse(row.patch_json) as UserDataRowPatch);
    } catch (error) {
      logSyncError('sync outbox row has invalid patch_json', error);
      await clearSyncOutboxIds(db, [row.id]);
    }
  }
  if (!hasUserDataRowPatchChanges(combined)) {
    await clearSyncOutboxIds(db, rows.map((r) => r.id));
    return { ok: true, drained: rows.length };
  }
  const safe = sanitizeDangerousBulkDeletes(combined);
  if (!hasUserDataRowPatchChanges(safe)) {
    logSyncError('sync outbox drain dropped dangerous bulk deletes only', new Error('bulk delete blocked'));
    await clearSyncOutboxIds(db, rows.map((r) => r.id));
    return { ok: true, drained: rows.length };
  }
  try {
    await pushUserDataPatch(serverUrl, token, safe);
    await clearSyncOutboxIds(db, rows.map((r) => r.id));
    markSyncPushResult('push-patch', true);
    logSyncInfo('sync outbox drained', { rows: rows.length });
    return { ok: true, drained: rows.length };
  } catch (error) {
    markSyncPushResult('push-patch', false, error instanceof Error ? error.message : String(error));
    logSyncError('sync outbox drain failed', error);
    return { ok: false, drained: 0 };
  }
};

/** Explicit enqueue for feature DBs that already know their row patch. */
export const markSyncRowPatch = enqueueSyncPatch;
