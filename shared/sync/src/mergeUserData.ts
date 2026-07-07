import { SYNC_TABLE_REGISTRY, type SyncTableDef } from './syncRegistry';
import type { UserData } from './userData';

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
  tsFn: (row: T) => number
): T[] => {
  const map = new Map<string, T>();
  for (const row of [...local, ...server]) {
    const key = keyFn(row);
    const existing = map.get(key);
    if (!existing || tsFn(row) >= tsFn(existing)) map.set(key, row);
  }
  return [...map.values()];
};

const mergeRowList = <T>(
  local: T[],
  server: T[],
  def: SyncTableDef
): T[] => {
  const tsColumn = def.updatedAtColumn;
  if (!tsColumn) throw new Error(`mergeRowList: ${def.sqlTable} has no updatedAtColumn`);
  const asRecord = (row: T): Record<string, unknown> => row as Record<string, unknown>;
  const merged = mergeByKey(
    local,
    server,
    (row) => rowKey(asRecord(row), def.rowKey),
    (row) => tsFromRow(asRecord(row), tsColumn)
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

/** Merge two snapshots — registry-driven last-write-wins per row. */
export const mergeUserData = (local: UserData, server: UserData): UserData => ({
  focusLog: mergeRowList(local.focusLog, server.focusLog, SYNC_TABLE_REGISTRY.focus_log),
  workoutLog: mergeRowList(local.workoutLog, server.workoutLog, SYNC_TABLE_REGISTRY.workout_log),
  appKv: mergeRowList(local.appKv, server.appKv, SYNC_TABLE_REGISTRY.app_kv),
  nutritionConfig: mergeSingleton(local.nutritionConfig, server.nutritionConfig, SYNC_TABLE_REGISTRY.nutrition_config),
  nutritionStaples: mergeRowList(local.nutritionStaples, server.nutritionStaples, SYNC_TABLE_REGISTRY.nutrition_staples),
  nutritionRegulars: mergeRowList(local.nutritionRegulars, server.nutritionRegulars, SYNC_TABLE_REGISTRY.nutrition_regulars),
  nutritionEntries: mergeRowList(local.nutritionEntries, server.nutritionEntries, SYNC_TABLE_REGISTRY.nutrition_entries),
  streakActivities: mergeRowList(local.streakActivities, server.streakActivities, SYNC_TABLE_REGISTRY.streak_activities),
  streakLogCells: mergeRowList(local.streakLogCells, server.streakLogCells, SYNC_TABLE_REGISTRY.streak_log_cells),
  streakActivityMeta: mergeRowList(local.streakActivityMeta, server.streakActivityMeta, SYNC_TABLE_REGISTRY.streak_activity_meta),
  waterConfig: mergeSingleton(local.waterConfig, server.waterConfig, SYNC_TABLE_REGISTRY.water_config),
  waterEntries: mergeRowList(local.waterEntries ?? [], server.waterEntries ?? [], SYNC_TABLE_REGISTRY.water_entries)
});
