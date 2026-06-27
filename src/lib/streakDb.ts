import { getDb } from '@/lib/db';
import { loadDayRolloverHourPref } from '@/lib/dayBoundaryPref';
import { buildActivityConfigMap } from '@/lib/streak/activityCatalog';
import { clearActivityLogs, incrementResetCount } from '@/lib/streak/activityReset';
import { backfillArchivedAt } from '@/lib/streak/archiveBackfill';
import { dayEndTimeFromRolloverHour, getCurrentDay } from '@/lib/streak/dates';
import { makeDeletionCell, makeLogCell, normalizeLogs } from '@/lib/streak/logs';
import { normalizeConfig, normalizeDataPayload } from '@/lib/streak/normalize';
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
};

type LogRow = { log_date: string; activity_id: string; state: string; updated_at: string };
type MetaRow = { activity_id: string; start_date: string | null; pause_since: string | null; unpaused_at: string | null; reset_count: number };

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
    'SELECT id, name, description, frequency, weekly_target, scheduled_days_json, can_fail, archived_at, sort_order, extra_calories, extra_protein, extra_water_ml FROM streak_activities ORDER BY sort_order, name'
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
  const metaRows = await db.select<MetaRow[]>('SELECT activity_id, start_date, pause_since, unpaused_at, reset_count FROM streak_activity_meta');
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

const saveActivities = async (config: StreakConfig): Promise<void> => {
  const db = await getDb();
  await db.execute('DELETE FROM streak_activities');
  let order = 0;
  const write = async (a: StreakActivity, archived: boolean) => {
    const scheduledJson = a.scheduledDays?.length ? JSON.stringify(a.scheduledDays) : null;
    await db.execute(
      'INSERT INTO streak_activities (id, name, description, frequency, weekly_target, scheduled_days_json, can_fail, archived_at, sort_order, extra_calories, extra_protein, extra_water_ml) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [
        a.id,
        a.name || a.id,
        a.description || null,
        a.frequency === 'weekly' ? 'weekly' : 'daily',
        a.weeklyTarget ?? null,
        scheduledJson,
        a.canFail ? 1 : 0,
        archived ? (a.archivedAt ?? null) : null,
        order++,
        a.extraCalories ?? null,
        a.extraProtein ?? null,
        a.extraWaterMl ?? null
      ]
    );
  };
  for (const a of config.activities) await write(a, false);
  for (const a of config.archivedActivities) await write(a, true);
};

const saveLogs = async (logs: StreakData['logs']): Promise<void> => {
  const db = await getDb();
  await db.execute('DELETE FROM streak_log_cells');
  const normalized = normalizeLogs(logs);
  for (const date of Object.keys(normalized)) {
    for (const [activityId, cell] of Object.entries(normalized[date])) {
      await db.execute(
        'INSERT INTO streak_log_cells (log_date, activity_id, state, updated_at) VALUES ($1, $2, $3, $4)',
        [date, activityId, cell.state, cell.updatedAt]
      );
    }
  }
};

const saveMeta = async (data: Omit<StreakData, 'logs' | 'stats'>): Promise<void> => {
  const db = await getDb();
  await db.execute('DELETE FROM streak_activity_meta');
  const ids = new Set<string>([
    ...Object.keys(data.activityStartDates),
    ...Object.keys(data.pausedActivities),
    ...Object.keys(data.unpausedActivities),
    ...Object.keys(data.activityResetCounts)
  ]);
  for (const activityId of ids) {
    await db.execute(
      'INSERT INTO streak_activity_meta (activity_id, start_date, pause_since, unpaused_at, reset_count) VALUES ($1, $2, $3, $4, $5)',
      [
        activityId,
        data.activityStartDates[activityId] ?? null,
        data.pausedActivities[activityId] ?? null,
        data.unpausedActivities[activityId] ?? null,
        data.activityResetCounts[activityId] ?? 0
      ]
    );
  }
};

export const saveStreakState = async (state: StreakState): Promise<StreakState> => {
  await saveActivities(state.config);
  await saveLogs(state.data.logs);
  await saveMeta(state.data);
  return loadStreakState();
};

export const importStreakVaultConfig = async (raw: unknown): Promise<StreakState> => {
  const config = normalizeConfig(raw);
  const state = await loadStreakState();
  state.config = config;
  backfillArchivedAt(config, state.data);
  return saveStreakState(state);
};

export const importStreakVaultData = async (raw: unknown): Promise<StreakState> => {
  const payload = normalizeDataPayload(raw);
  const state = await loadStreakState();
  state.data = { ...payload, stats: {} };
  backfillArchivedAt(state.config, state.data);
  return saveStreakState(state);
};

export const importStreakVault = async (configRaw: unknown, dataRaw: unknown): Promise<StreakState> => {
  const config = normalizeConfig(configRaw);
  const payload = normalizeDataPayload(dataRaw);
  const rolloverHour = await loadDayRolloverHourPref();
  const dayEndTime = dayEndTimeFromRolloverHour(rolloverHour);
  const currentDay = getCurrentDay(dayEndTime);
  const data: StreakData = { ...payload, stats: {} };
  backfillArchivedAt(config, data);
  const state = buildState(config, data, currentDay, dayEndTime);
  return saveStreakState(state);
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
  } else {
    dayLog[activityId] = makeLogCell(newState)!;
  }
  logs[day] = dayLog;
  state.data.logs = logs;
  if (!state.data.activityStartDates[activityId]) state.data.activityStartDates[activityId] = day;
  return saveStreakState(state);
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
  return saveStreakState(state);
};

export const resetStreakActivity = async (state: StreakState, activityId: string): Promise<StreakState> => {
  const day = state.currentDay;
  state.data.logs = clearActivityLogs(state.data.logs, activityId);
  state.data.activityStartDates = { ...state.data.activityStartDates, [activityId]: day };
  state.data.activityResetCounts = incrementResetCount(state.data.activityResetCounts, activityId);
  return saveStreakState(state);
};

export const archiveStreakActivity = async (state: StreakState, activityId: string): Promise<StreakState> => {
  const day = state.currentDay;
  const act = state.config.activities.find((a) => a.id === activityId);
  if (!act) return state;
  state.config.activities = state.config.activities.filter((a) => a.id !== activityId);
  state.config.archivedActivities = [...state.config.archivedActivities, { ...act, archivedAt: day }];
  const paused = { ...state.data.pausedActivities };
  delete paused[activityId];
  state.data.pausedActivities = paused;
  const unpaused = { ...state.data.unpausedActivities };
  delete unpaused[activityId];
  state.data.unpausedActivities = unpaused;
  return saveStreakState(state);
};

export const upsertStreakActivity = async (state: StreakState, activity: StreakActivity, isNew: boolean): Promise<StreakState> => {
  if (isNew) {
    state.config.activities = [...state.config.activities, activity];
    state.data.activityStartDates = { ...state.data.activityStartDates, [activity.id]: state.currentDay };
  } else {
    state.config.activities = state.config.activities.map((a) => {
      if (a.id !== activity.id) return a;
      const next: StreakActivity = { ...a, ...activity };
      if (!activity.extraCalories) delete next.extraCalories;
      if (!activity.extraProtein) delete next.extraProtein;
      if (!activity.extraWaterMl) delete next.extraWaterMl;
      return next;
    });
  }
  return saveStreakState(state);
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
  return saveStreakState(state);
};

export { emptyData };
