import { SYNC_TABLE_REGISTRY, type SyncTableDef } from './syncRegistry';
import type { StreakActivity, SyncTombstone, UserData } from './userData';
import { normalizeSyncTombstones, tombstoneRowKey, TOMBSTONE_KEY_SEP } from './userData';

const parseTs = (v: string | number): number => (typeof v === 'number' ? v : Date.parse(v) || 0);

const rowKey = (row: Record<string, unknown>, keys: string[]): string =>
  keys.map((k) => String(row[k] ?? '')).join('\0');

const tsFromRow = (row: Record<string, unknown>, column: string): number => {
  const v = row[column];
  if (v == null) return 0;
  return parseTs(v as string | number);
};

const mergeByKey = <T>(
  local: T[],
  server: T[],
  keyFn: (row: T) => string,
  pick: (a: T, b: T) => T
): T[] => {
  const map = new Map<string, T>();
  for (const row of [...local, ...server]) {
    const key = keyFn(row);
    const existing = map.get(key);
    if (!existing) map.set(key, row);
    else map.set(key, pick(existing, row));
  }
  return [...map.values()];
};

const lwwPick = <T>(
  a: T,
  b: T,
  tsFn: (row: T) => number
): T => (tsFn(b) >= tsFn(a) ? b : a);

/** Archive is one-way in the UI: keep archived_at even if a newer active-only row arrives (reorder/edit race). */
const pickStreakActivity = (a: StreakActivity, b: StreakActivity): StreakActivity => {
  const aTs = parseTs(a.updated_at);
  const bTs = parseTs(b.updated_at);
  const newer = bTs >= aTs ? b : a;
  const older = newer === a ? b : a;
  if (newer.archived_at) return newer;
  if (older.archived_at) return { ...newer, archived_at: older.archived_at };
  return newer;
};

const mergeRowList = <T>(
  local: T[],
  server: T[],
  def: SyncTableDef,
  pick?: (a: T, b: T) => T
): T[] => {
  const tsColumn = def.updatedAtColumn;
  if (!tsColumn) throw new Error(`mergeRowList: ${def.sqlTable} has no updatedAtColumn`);
  const asRecord = (row: T): Record<string, unknown> => row as Record<string, unknown>;
  const tsFn = (row: T) => tsFromRow(asRecord(row), tsColumn);
  const merged = mergeByKey(
    local,
    server,
    (row) => rowKey(asRecord(row), def.rowKey),
    pick ?? ((a, b) => lwwPick(a, b, tsFn))
  );
  if (def.sqlTable === 'streak_activities') {
    return merged.sort((a, b) => Number(asRecord(a).sort_order ?? 0) - Number(asRecord(b).sort_order ?? 0));
  }
  return merged;
};

const mergeSingleton = <T>(
  local: T | null,
  server: T | null,
  def: SyncTableDef
): T | null => {
  const tsColumn = def.updatedAtColumn;
  if (!tsColumn) throw new Error(`mergeSingleton: ${def.sqlTable} has no updatedAtColumn`);
  if (!local) return server;
  if (!server) return local;
  const asRecord = (row: T): Record<string, unknown> => row as Record<string, unknown>;
  return tsFromRow(asRecord(server), tsColumn) >= tsFromRow(asRecord(local), tsColumn) ? server : local;
};

const mergeTombstones = (local: SyncTombstone[], server: SyncTombstone[]): SyncTombstone[] =>
  mergeByKey(
    normalizeSyncTombstones(local),
    normalizeSyncTombstones(server),
    (t) => `${t.entity}${TOMBSTONE_KEY_SEP}${t.row_key}`,
    (a, b) => (parseTs(b.deleted_at) >= parseTs(a.deleted_at) ? b : a)
  );

const dropTombstoned = <T>(
  rows: T[],
  entity: string,
  keyFn: (row: T) => string,
  tsFn: (row: T) => number,
  tombstones: SyncTombstone[]
): T[] => {
  const byKey = new Map<string, number>();
  for (const t of tombstones) {
    if (t.entity !== entity) continue;
    byKey.set(t.row_key, parseTs(t.deleted_at));
  }
  if (!byKey.size) return rows;
  return rows.filter((row) => {
    const delAt = byKey.get(keyFn(row));
    if (delAt == null) return true;
    return tsFn(row) > delAt;
  });
};

/** Merge two snapshots — registry-driven last-write-wins per row; tombstones drop hard-deleted ghosts. */
export const mergeUserData = (local: UserData, server: UserData): UserData => {
  const syncTombstones = mergeTombstones(local.syncTombstones ?? [], server.syncTombstones ?? []);
  const streakActivities = dropTombstoned(
    mergeRowList(
      local.streakActivities,
      server.streakActivities,
      SYNC_TABLE_REGISTRY.streak_activities,
      pickStreakActivity
    ),
    'streakActivities',
    (r) => r.id,
    (r) => parseTs(r.updated_at),
    syncTombstones
  );
  const streakLogCells = dropTombstoned(
    mergeRowList(local.streakLogCells, server.streakLogCells, SYNC_TABLE_REGISTRY.streak_log_cells),
    'streakLogCells',
    (r) => tombstoneRowKey(r.log_date, r.activity_id),
    (r) => parseTs(r.updated_at),
    syncTombstones
  );
  const streakActivityMeta = dropTombstoned(
    mergeRowList(local.streakActivityMeta, server.streakActivityMeta, SYNC_TABLE_REGISTRY.streak_activity_meta),
    'streakActivityMeta',
    (r) => r.activity_id,
    (r) => parseTs(r.updated_at),
    syncTombstones
  );
  return {
    focusLog: mergeRowList(local.focusLog, server.focusLog, SYNC_TABLE_REGISTRY.focus_log),
    workoutLog: mergeRowList(local.workoutLog, server.workoutLog, SYNC_TABLE_REGISTRY.workout_log),
    appKv: dropTombstoned(
      mergeRowList(local.appKv, server.appKv, SYNC_TABLE_REGISTRY.app_kv),
      'appKv',
      (r) => r.key,
      (r) => parseTs(r.updated_at),
      syncTombstones
    ),
    nutritionConfig: mergeSingleton(local.nutritionConfig, server.nutritionConfig, SYNC_TABLE_REGISTRY.nutrition_config),
    nutritionStaples: dropTombstoned(
      mergeRowList(local.nutritionStaples, server.nutritionStaples, SYNC_TABLE_REGISTRY.nutrition_staples),
      'nutritionStaples',
      (r) => r.id,
      (r) => parseTs(r.updated_at),
      syncTombstones
    ),
    nutritionRegulars: dropTombstoned(
      mergeRowList(local.nutritionRegulars, server.nutritionRegulars, SYNC_TABLE_REGISTRY.nutrition_regulars),
      'nutritionRegulars',
      (r) => r.id,
      (r) => parseTs(r.updated_at),
      syncTombstones
    ),
    nutritionEntries: mergeRowList(local.nutritionEntries, server.nutritionEntries, SYNC_TABLE_REGISTRY.nutrition_entries),
    streakActivities,
    streakLogCells,
    streakActivityMeta,
    waterConfig: mergeSingleton(local.waterConfig, server.waterConfig, SYNC_TABLE_REGISTRY.water_config),
    waterEntries: mergeRowList(local.waterEntries ?? [], server.waterEntries ?? [], SYNC_TABLE_REGISTRY.water_entries),
    syncTombstones
  };
};
