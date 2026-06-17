import { parseDate } from '@/lib/streak/dates';
import type { StreakActivity, StreakConfig, StreakData } from '@/lib/streak/types';

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5,
  sat: 6, saturday: 6
};

export const parseScheduledDays = (scheduledDays: string[] | undefined): number[] => {
  if (!scheduledDays?.length) return [];
  return scheduledDays.map((d) => DAY_NAME_TO_INDEX[d.toLowerCase()]).filter((d) => d !== undefined);
};

export const buildActivityCatalog = (config: StreakConfig, data: StreakData): StreakActivity[] => {
  const byId = new Map<string, StreakActivity>();
  const add = (a: StreakActivity | undefined, opts?: { fromConfig?: boolean; logOnly?: boolean }) => {
    if (!a?.id) return;
    const prev: StreakActivity = byId.get(a.id) || { id: a.id };
    byId.set(a.id, {
      ...prev,
      ...a,
      _fromConfig: !!(prev._fromConfig || opts?.fromConfig),
      _logOnly: !!(prev._logOnly || opts?.logOnly) && !prev._fromConfig && !opts?.fromConfig
    });
  };
  for (const a of config?.activities || []) add(a, { fromConfig: true });
  for (const a of config?.archivedActivities || []) add(a, { fromConfig: true });
  for (const id of Object.keys(data?.activityStartDates || {})) {
    if (!byId.has(id)) add({ id }, { logOnly: true });
  }
  for (const log of Object.values(data?.logs || {})) {
    for (const id of Object.keys(log)) {
      if (!byId.has(id)) add({ id }, { logOnly: true });
    }
  }
  return [...byId.values()];
};

export const isActivityDueOnDay = (activity: StreakActivity, dayStr: string): boolean => {
  if (activity.frequency === 'weekly') {
    const indices = parseScheduledDays(activity.scheduledDays);
    if (!indices.length) return false;
    return indices.includes(parseDate(dayStr).getDay());
  }
  return true;
};

export const getActivityStartDate = (data: StreakData, activityId: string): string | null => {
  if (!data._inferredStartDates) data._inferredStartDates = {};
  if (data._inferredStartDates[activityId] !== undefined) return data._inferredStartDates[activityId];
  let start = data.activityStartDates?.[activityId] || null;
  if (!start) {
    for (const day of Object.keys(data.logs || {})) {
      if (data.logs[day]?.[activityId] && (!start || day < start)) start = day;
    }
  }
  data._inferredStartDates[activityId] = start;
  return start;
};

export const getActivityLastLogDate = (data: StreakData, activityId: string): string | null => {
  if (!data._inferredLastLogDates) data._inferredLastLogDates = {};
  if (data._inferredLastLogDates[activityId] !== undefined) return data._inferredLastLogDates[activityId];
  let last: string | null = null;
  for (const day of Object.keys(data.logs || {})) {
    if (data.logs[day]?.[activityId] && (!last || day > last)) last = day;
  }
  data._inferredLastLogDates[activityId] = last;
  return last;
};

export const isActivityActiveOnDay = (activity: StreakActivity, data: StreakData, dayStr: string): boolean => {
  const startedOn = getActivityStartDate(data, activity.id);
  if (!startedOn || startedOn > dayStr) return false;
  const pausedSince = data.pausedActivities?.[activity.id];
  if (pausedSince && pausedSince <= dayStr) return false;
  if (activity.archivedAt && activity.archivedAt <= dayStr) return false;
  if (activity._logOnly) {
    const lastLog = getActivityLastLogDate(data, activity.id);
    if (!lastLog || dayStr > lastLog) return false;
  }
  return isActivityDueOnDay(activity, dayStr);
};

export const getActiveActivitiesForDay = (catalog: StreakActivity[], data: StreakData, dayStr: string): StreakActivity[] =>
  catalog.filter((a) => isActivityActiveOnDay(a, data, dayStr));

export const buildActivityConfigMap = (config: StreakConfig): Record<string, StreakActivity> => {
  const map: Record<string, StreakActivity> = {};
  for (const a of [...(config.activities || []), ...(config.archivedActivities || [])]) {
    if (a?.id) map[a.id] = a;
  }
  return map;
};
