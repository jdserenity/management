import { getDb } from '@/lib/db';
import { loadDayRolloverHourPref } from '@/lib/dayBoundaryPref';
import { buildActivityConfigMap } from '@/lib/streak/activityCatalog';
import { clearActivityLogs, incrementResetCount } from '@/lib/streak/activityReset';
import { dayEndTimeFromRolloverHour, getCurrentDay } from '@/lib/streak/dates';
import { makeDeletionCell, makeLogCell, normalizeLogs } from '@/lib/streak/logs';
import { recalculateAllStats } from '@/lib/streak/stats';
import type { StreakActivity, StreakConfig, StreakData, StreakLogState, StreakState } from '@/lib/streak/types';

type ActivityRow = {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  weekly_target: number | null;
  scheduled_days_json: string | null;
  can_fail: number;
  archived_at: string | null;
  sort_order: number;
  extra_calories: number | null;
  extra_protein: number | null;
  extra_water_ml: number | null;
  updated_at: string;
};

type LogRow = { log_date: string; activity_id: string; state: string; updated_at: string };
type MetaRow = {
  activity_id: string;
  start_date: string | null;
  pause_since: string | null;
  unpaused_at: string | null;
  reset_count: number;
  updated_at: string;
};

const syncNow = (): string => new Date().toISOString();

const activityFromRow = (row: ActivityRow): StreakActivity => {
  const a: StreakActivity = {
    id: row.id,
    name: row.name,
    frequency: row.frequency === 'weekly' ? 'weekly' : 'daily',
    canFail: row.can_fail === 1
  };
  if (row.description) a.description = row.description;
  if (row.weekly_target != null) a.weeklyTarget = row.weekly_target;
  if (row.scheduled_days_json) {
    try {
      const parsed = JSON.parse(row.scheduled_days_json);
      if (Array.isArray(parsed)) a.scheduledDays = parsed;
    } catch { /* ignore */ }
  }
  if (row.archived_at) a.archivedAt = row.archived_at;
  if (row.extra_calories != null && row.extra_calories > 0) a.extraCalories = row.extra_calories;
  if (row.extra_protein != null && row.extra_protein > 0) a.extraProtein = row.extra_protein;
  if (row.extra_water_ml != null && row.extra_water_ml > 0) a.extraWaterMl = row.extra_water_ml;
  return a;
};

const activityBinds = (a: StreakActivity, archived: boolean, sortOrder: number, updatedAt: string) => {
  const scheduledJson = a.scheduledDays?.length ? JSON.stringify(a.scheduledDays) : null;
  return [
    a.id,
    a.name || a.id,
    a.description || null,
    a.frequency === 'weekly' ? 'weekly' : 'daily',
    a.weeklyTarget ?? null,
    scheduledJson,
    a.canFail ? 1 : 0,
    archived ? (a.archivedAt ?? null) : null,
    sortOrder,
    a.extraCalories ?? null,
    a.extraProtein ?? null,
    a.extraWaterMl ?? null,
    updatedAt
  ];
};

const UPSERT_ACTIVITY_SQL = `INSERT INTO streak_activities (id, name, description, frequency, weekly_target, scheduled_days_json, can_fail, archived_at, sort_order, extra_calories, extra_protein, extra_water_ml, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  description=excluded.description,
  frequency=excluded.frequency,
  weekly_target=excluded.weekly_target,
  scheduled_days_json=excluded.scheduled_days_json,
  can_fail=excluded.can_fail,
  archived_at=excluded.archived_at,
  sort_order=excluded.sort_order,
  extra_calories=excluded.extra_calories,
  extra_protein=excluded.extra_protein,
  extra_water_ml=excluded.extra_water_ml,
  updated_at=excluded.updated_at`;

const upsertActivityRow = async (a: StreakActivity, archived: boolean, sortOrder: number, updatedAt = syncNow()): Promise<void> => {
  const db = await getDb();
  await db.execute(UPSERT_ACTIVITY_SQL, activityBinds(a, archived, sortOrder, updatedAt));
};

const upsertLogCell = async (logDate: string, activityId: string, state: string, updatedAt: string): Promise<void> => {
  const db = await getDb();
  await db.execute(
    `INSERT INTO streak_log_cells (log_date, activity_id, state, updated_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT(log_date, activity_id) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at`,
    [logDate, activityId, state, updatedAt]
  );
};

const deleteLogCell = async (logDate: string, activityId: string): Promise<void> => {
  const db = await getDb();
  await db.execute('DELETE FROM streak_log_cells WHERE log_date=$1 AND activity_id=$2', [logDate, activityId]);
};

const upsertMetaRow = async (
  activityId: string,
  data: Pick<StreakData, 'activityStartDates' | 'pausedActivities' | 'unpausedActivities' | 'activityResetCounts'>,
  updatedAt = syncNow()
): Promise<void> => {
  const db = await getDb();
  await db.execute(
    `INSERT INTO streak_activity_meta (activity_id, start_date, pause_since, unpaused_at, reset_count, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(activity_id) DO UPDATE SET
       start_date=excluded.start_date,
       pause_since=excluded.pause_since,
       unpaused_at=excluded.unpaused_at,
       reset_count=excluded.reset_count,
       updated_at=excluded.updated_at`,
    [
      activityId,
      data.activityStartDates[activityId] ?? null,
      data.pausedActivities[activityId] ?? null,
      data.unpausedActivities[activityId] ?? null,
      data.activityResetCounts[activityId] ?? 0,
      updatedAt
    ]
  );
};

const emptyData = (): StreakData => ({
  logs: {},
  activityStartDates: {},
  pausedActivities: {},
  unpausedActivities: {},
  activityResetCounts: {},
  stats: {}
});

const buildState = (config: StreakConfig, data: StreakData, currentDay: string, dayEndTime: string): StreakState => {
  const activityConfigMap = buildActivityConfigMap(config);
  recalculateAllStats(data, activityConfigMap, dayEndTime);
  return { config, data, activityConfigMap, currentDay };
};

const loadRows = async (): Promise<{ config: StreakConfig; partial: Omit<StreakData, 'stats'> }> => {
  const db = await getDb();
  const activityRows = await db.select<ActivityRow[]>(
    'SELECT id, name, description, frequency, weekly_target, scheduled_days_json, can_fail, archived_at, sort_order, extra_calories, extra_protein, extra_water_ml, updated_at FROM streak_activities ORDER BY sort_order, name'
  );
  const activities: StreakActivity[] = [];
  const archivedActivities: StreakActivity[] = [];
  for (const row of activityRows) {
    const a = activityFromRow(row);
    if (row.archived_at) archivedActivities.push(a);
    else activities.push(a);
  }
  const logRows = await db.select<LogRow[]>(
    'SELECT log_date, activity_id, state, updated_at FROM streak_log_cells ORDER BY log_date, activity_id'
  );
  const logs: StreakData['logs'] = {};
  for (const row of logRows) {
    if (!logs[row.log_date]) logs[row.log_date] = {};
    if (row.state === 'none') {
      logs[row.log_date][row.activity_id] = { state: 'none', updatedAt: row.updated_at };
    } else {
      logs[row.log_date][row.activity_id] = { state: row.state as StreakLogState, updatedAt: row.updated_at };
    }
  }
  const metaRows = await db.select<MetaRow[]>('SELECT activity_id, start_date, pause_since, unpaused_at, reset_count, updated_at FROM streak_activity_meta');
  const activityStartDates: Record<string, string> = {};
  const pausedActivities: Record<string, string> = {};
  const unpausedActivities: Record<string, string> = {};
  const activityResetCounts: Record<string, number> = {};
  for (const row of metaRows) {
    if (row.start_date) activityStartDates[row.activity_id] = row.start_date;
    if (row.pause_since) pausedActivities[row.activity_id] = row.pause_since;
    if (row.unpaused_at) unpausedActivities[row.activity_id] = row.unpaused_at;
    if (row.reset_count) activityResetCounts[row.activity_id] = row.reset_count;
  }
  return {
    config: { activities, archivedActivities },
    partial: { logs: normalizeLogs(logs), activityStartDates, pausedActivities, unpausedActivities, activityResetCounts }
  };
};

export const loadStreakState = async (): Promise<StreakState> => {
  const rolloverHour = await loadDayRolloverHourPref();
  const dayEndTime = dayEndTimeFromRolloverHour(rolloverHour);
  const currentDay = getCurrentDay(dayEndTime);
  const { config, partial } = await loadRows();
  const data: StreakData = { ...partial, stats: {} };
  return buildState(config, data, currentDay, dayEndTime);
};

const deleteActivitiesNotIn = async (ids: string[]): Promise<void> => {
  const db = await getDb();
  if (!ids.length) {
    await db.execute('DELETE FROM streak_activities');
    return;
  }
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  await db.execute(`DELETE FROM streak_activities WHERE id NOT IN (${placeholders})`, ids);
};

const saveActivities = async (config: StreakConfig): Promise<void> => {
  const updatedAt = syncNow();
  let order = 0;
  const ids: string[] = [];
  for (const a of config.activities) {
    ids.push(a.id);
    await upsertActivityRow(a, false, order++, updatedAt);
  }
  for (const a of config.archivedActivities) {
    ids.push(a.id);
    await upsertActivityRow(a, true, order++, updatedAt);
  }
  await deleteActivitiesNotIn(ids);
};

const saveLogs = async (logs: StreakData['logs']): Promise<void> => {
  const db = await getDb();
  const normalized = normalizeLogs(logs);
  const keepKeys: string[] = [];
  for (const date of Object.keys(normalized)) {
    for (const [activityId, cell] of Object.entries(normalized[date])) {
      keepKeys.push(`${date}\0${activityId}`);
      await db.execute(
        `INSERT INTO streak_log_cells (log_date, activity_id, state, updated_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT(log_date, activity_id) DO UPDATE SET state=excluded.state, updated_at=excluded.updated_at`,
        [date, activityId, cell.state, cell.updatedAt]
      );
    }
  }
  const rows = await db.select<LogRow[]>('SELECT log_date, activity_id, state, updated_at FROM streak_log_cells');
  for (const row of rows) {
    const key = `${row.log_date}\0${row.activity_id}`;
    if (!keepKeys.includes(key)) await deleteLogCell(row.log_date, row.activity_id);
  }
};

const saveMeta = async (data: Omit<StreakData, 'logs' | 'stats'>): Promise<void> => {
  const db = await getDb();
  const ids = new Set<string>([
    ...Object.keys(data.activityStartDates),
    ...Object.keys(data.pausedActivities),
    ...Object.keys(data.unpausedActivities),
    ...Object.keys(data.activityResetCounts)
  ]);
  const updatedAt = syncNow();
  for (const activityId of ids) await upsertMetaRow(activityId, data, updatedAt);
  const rows = await db.select<MetaRow[]>('SELECT activity_id, start_date, pause_since, unpaused_at, reset_count, updated_at FROM streak_activity_meta');
  for (const row of rows) {
    if (!ids.has(row.activity_id)) await db.execute('DELETE FROM streak_activity_meta WHERE activity_id=$1', [row.activity_id]);
  }
};

export const saveStreakState = async (state: StreakState): Promise<StreakState> => {
  await saveActivities(state.config);
  await saveLogs(state.data.logs);
  await saveMeta(state.data);
  return loadStreakState();
};

export const isStreakEmpty = (state: StreakState): boolean =>
  state.config.activities.length === 0 &&
  state.config.archivedActivities.length === 0 &&
  Object.keys(state.data.logs).length === 0;

export const saveStreakLog = async (
  state: StreakState,
  activityId: string,
  newState: StreakLogState | null,
  logDay?: string
): Promise<StreakState> => {
  const day = logDay || state.currentDay;
  const logs = { ...state.data.logs };
  if (!logs[day]) logs[day] = {};
  const dayLog = { ...logs[day] };
  if (newState == null || newState === 'none') {
    dayLog[activityId] = makeDeletionCell();
    await deleteLogCell(day, activityId);
  } else {
    const cell = makeLogCell(newState)!;
    dayLog[activityId] = cell;
    await upsertLogCell(day, activityId, cell.state, cell.updatedAt);
  }
  logs[day] = dayLog;
  state.data.logs = logs;
  if (!state.data.activityStartDates[activityId]) {
    state.data.activityStartDates = { ...state.data.activityStartDates, [activityId]: day };
    await upsertMetaRow(activityId, state.data);
  }
  const rolloverHour = await loadDayRolloverHourPref();
  const dayEndTime = dayEndTimeFromRolloverHour(rolloverHour);
  return buildState(state.config, state.data, state.currentDay, dayEndTime);
};

export const setActivityPaused = async (state: StreakState, activityId: string, paused: boolean): Promise<StreakState> => {
  const day = state.currentDay;
  if (paused) {
    state.data.pausedActivities = { ...state.data.pausedActivities, [activityId]: day };
    const unpaused = { ...state.data.unpausedActivities };
    delete unpaused[activityId];
    state.data.unpausedActivities = unpaused;
  } else {
    const pausedMap = { ...state.data.pausedActivities };
    delete pausedMap[activityId];
    state.data.pausedActivities = pausedMap;
    state.data.unpausedActivities = { ...state.data.unpausedActivities, [activityId]: day };
  }
  await upsertMetaRow(activityId, state.data);
  const rolloverHour = await loadDayRolloverHourPref();
  const dayEndTime = dayEndTimeFromRolloverHour(rolloverHour);
  return buildState(state.config, state.data, state.currentDay, dayEndTime);
};

export const resetStreakActivity = async (state: StreakState, activityId: string): Promise<StreakState> => {
  const day = state.currentDay;
  state.data.logs = clearActivityLogs(state.data.logs, activityId);
  state.data.activityStartDates = { ...state.data.activityStartDates, [activityId]: day };
  state.data.activityResetCounts = incrementResetCount(state.data.activityResetCounts, activityId);
  const db = await getDb();
  await db.execute('DELETE FROM streak_log_cells WHERE activity_id=$1', [activityId]);
  await upsertMetaRow(activityId, state.data);
  const rolloverHour = await loadDayRolloverHourPref();
  const dayEndTime = dayEndTimeFromRolloverHour(rolloverHour);
  return buildState(state.config, state.data, state.currentDay, dayEndTime);
};

export const archiveStreakActivity = async (state: StreakState, activityId: string): Promise<StreakState> => {
  const day = state.currentDay;
  const act = state.config.activities.find((a) => a.id === activityId);
  if (!act) return state;
  const archived = { ...act, archivedAt: day };
  const sortOrder = state.config.archivedActivities.length;
  await upsertActivityRow(archived, true, sortOrder, syncNow());
  state.config.activities = state.config.activities.filter((a) => a.id !== activityId);
  state.config.archivedActivities = [...state.config.archivedActivities, archived];
  const paused = { ...state.data.pausedActivities };
  delete paused[activityId];
  state.data.pausedActivities = paused;
  const unpaused = { ...state.data.unpausedActivities };
  delete unpaused[activityId];
  state.data.unpausedActivities = unpaused;
  await upsertMetaRow(activityId, state.data);
  const rolloverHour = await loadDayRolloverHourPref();
  const dayEndTime = dayEndTimeFromRolloverHour(rolloverHour);
  return buildState(state.config, state.data, state.currentDay, dayEndTime);
};

export const upsertStreakActivity = async (state: StreakState, activity: StreakActivity, isNew: boolean): Promise<StreakState> => {
  if (isNew) {
    state.config.activities = [...state.config.activities, activity];
    state.data.activityStartDates = { ...state.data.activityStartDates, [activity.id]: state.currentDay };
    await upsertActivityRow(activity, false, state.config.activities.length - 1);
    await upsertMetaRow(activity.id, state.data);
  } else {
    state.config.activities = state.config.activities.map((a) => {
      if (a.id !== activity.id) return a;
      const next: StreakActivity = { ...a, ...activity };
      if (!activity.extraCalories) delete next.extraCalories;
      if (!activity.extraProtein) delete next.extraProtein;
      if (!activity.extraWaterMl) delete next.extraWaterMl;
      return next;
    });
    const idx = state.config.activities.findIndex((a) => a.id === activity.id);
    const merged = state.config.activities[idx];
    if (merged) await upsertActivityRow(merged, false, idx);
  }
  const rolloverHour = await loadDayRolloverHourPref();
  const dayEndTime = dayEndTimeFromRolloverHour(rolloverHour);
  return buildState(state.config, state.data, state.currentDay, dayEndTime);
};

export const updateStreakActivityDescription = async (
  state: StreakState,
  activityId: string,
  description: string
): Promise<StreakState> => {
  state.config.activities = state.config.activities.map((a) => {
    if (a.id !== activityId) return a;
    const next = { ...a };
    if (description.trim()) next.description = description.trim();
    else delete next.description;
    return next;
  });
  const idx = state.config.activities.findIndex((a) => a.id === activityId);
  const merged = state.config.activities[idx];
  if (merged) await upsertActivityRow(merged, false, idx);
  const rolloverHour = await loadDayRolloverHourPref();
  const dayEndTime = dayEndTimeFromRolloverHour(rolloverHour);
  return buildState(state.config, state.data, state.currentDay, dayEndTime);
};

export { emptyData };
