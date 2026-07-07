import type { UserData } from './userData';

const parseTs = (v: string | number): number => (typeof v === 'number' ? v : Date.parse(v) || 0);

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

const maxActivityLogTs = (data: UserData, activityId: string): number => {
  let max = 0;
  for (const c of data.streakLogCells) {
    if (c.activity_id === activityId) max = Math.max(max, parseTs(c.updated_at));
  }
  return max;
};

const mergeStreakActivities = (local: UserData, server: UserData): UserData['streakActivities'] => {
  const map = new Map<string, UserData['streakActivities'][number]>();
  for (const row of [...local.streakActivities, ...server.streakActivities]) {
    const existing = map.get(row.id);
    if (!existing) { map.set(row.id, row); continue; }
    const localTs = maxActivityLogTs(local, row.id);
    const serverTs = maxActivityLogTs(server, row.id);
    map.set(row.id, serverTs > localTs ? row : existing);
  }
  return [...map.values()].sort((a, b) => a.sort_order - b.sort_order);
};

const mergeStreakActivityMeta = (local: UserData, server: UserData): UserData['streakActivityMeta'] => {
  const map = new Map<string, UserData['streakActivityMeta'][number]>();
  for (const row of [...local.streakActivityMeta, ...server.streakActivityMeta]) {
    const existing = map.get(row.activity_id);
    if (!existing) { map.set(row.activity_id, row); continue; }
    const localTs = maxActivityLogTs(local, row.activity_id);
    const serverTs = maxActivityLogTs(server, row.activity_id);
    map.set(row.activity_id, serverTs > localTs ? row : existing);
  }
  return [...map.values()];
};
const mergeConfigRows = <T extends { id: string }>(
  local: T[],
  server: T[],
  localTs: number,
  serverTs: number
): T[] => {
  const map = new Map<string, T>();
  for (const row of [...local, ...server]) {
    const existing = map.get(row.id);
    if (!existing) { map.set(row.id, row); continue; }
    map.set(row.id, serverTs > localTs ? row : existing);
  }
  return [...map.values()];
};

const maxEntryTs = (entries: { updated_at: string }[]): number =>
  entries.reduce((max, e) => Math.max(max, parseTs(e.updated_at)), 0);

/** Merge two snapshots — per-row last-write-wins where timestamps exist. */
export const mergeUserData = (local: UserData, server: UserData): UserData => {
  const localNutTs = maxEntryTs(local.nutritionEntries);
  const serverNutTs = maxEntryTs(server.nutritionEntries);
  const localWaterTs = maxEntryTs(local.waterEntries ?? []);
  const serverWaterTs = maxEntryTs(server.waterEntries ?? []);

  const nutritionConfig = (() => {
    if (!local.nutritionConfig) return server.nutritionConfig;
    if (!server.nutritionConfig) return local.nutritionConfig;
    return serverNutTs >= localNutTs ? server.nutritionConfig : local.nutritionConfig;
  })();

  const waterConfig = (() => {
    if (!local.waterConfig) return server.waterConfig;
    if (!server.waterConfig) return local.waterConfig;
    return serverWaterTs >= localWaterTs ? server.waterConfig : local.waterConfig;
  })();

  return {
    focusLog: mergeByKey(local.focusLog, server.focusLog, (r) => r.id, (r) => r.completed_at),
    workoutLog: mergeByKey(local.workoutLog, server.workoutLog, (r) => r.id, (r) => r.completed_at),
    appKv: mergeByKey(local.appKv, server.appKv, (r) => r.key, (r) => r.updated_at),
    nutritionConfig,
    nutritionStaples: mergeConfigRows(local.nutritionStaples, server.nutritionStaples, localNutTs, serverNutTs),
    nutritionRegulars: mergeConfigRows(local.nutritionRegulars, server.nutritionRegulars, localNutTs, serverNutTs),
    nutritionEntries: mergeByKey(local.nutritionEntries, server.nutritionEntries, (r) => r.id, (r) => parseTs(r.updated_at)),
    streakActivities: mergeStreakActivities(local, server),
    streakLogCells: mergeByKey(
      local.streakLogCells,
      server.streakLogCells,
      (r) => `${r.log_date}\0${r.activity_id}`,
      (r) => parseTs(r.updated_at)
    ),
    streakActivityMeta: mergeStreakActivityMeta(local, server),
    waterConfig,
    waterEntries: mergeByKey(
      local.waterEntries ?? [],
      server.waterEntries ?? [],
      (r) => r.id,
      (r) => parseTs(r.updated_at)
    )
  };
};
