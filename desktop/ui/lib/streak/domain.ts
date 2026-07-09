import { getLogState, normalizeLogs } from '@/lib/streak/logs';
import { parseDate, formatDate } from '@/lib/streak/dates';
import type { StreakActivity, StreakConfig, StreakData } from '@/lib/streak/types';


export const clearActivityLogs = (
  logs: StreakData['logs'],
  activityId: string
): StreakData['logs'] => {
  const next: StreakData['logs'] = {};
  for (const date of Object.keys(logs || {})) {
    const day = logs[date];
    if (!day?.[activityId]) { next[date] = day; continue; }
    const copy = { ...day };
    delete copy[activityId];
    if (Object.keys(copy).length) next[date] = copy;
  }
  return next;
};

export const incrementResetCount = (
  counts: Record<string, number> | undefined,
  activityId: string
): Record<string, number> => {
  const next = { ...(counts || {}) };
  next[activityId] = (next[activityId] || 0) + 1;
  return next;
};

export const mergeResetCounts = (
  memCounts: Record<string, number> | undefined,
  fileCounts: Record<string, number> | undefined
): Record<string, number> => {
  const merged = { ...(fileCounts || {}) };
  for (const [id, count] of Object.entries(memCounts || {})) {
    merged[id] = Math.max(merged[id] || 0, count);
  }
  return merged;
};

export const dayHasActivityLog = (
  day: Record<string, unknown> | undefined,
  activityId: string
): boolean => {
  if (!day?.[activityId]) return false;
  return getLogState(day[activityId] as never) != null;
};

export const pausedStateFromVault = (
  vaultPaused: Record<string, string> | undefined,
  vaultUnpaused: Record<string, string> | undefined
): Record<string, string> => {
  const paused: Record<string, string> = {};
  for (const [id, date] of Object.entries(vaultPaused || {})) {
    const unpausedAt = (vaultUnpaused || {})[id];
    if (unpausedAt && unpausedAt >= date) continue;
    paused[id] = date;
  }
  return paused;
};

export const mergePausedOnIncoming = (
  memPaused: Record<string, string> | undefined,
  memUnpaused: Record<string, string> | undefined,
  filePaused: Record<string, string> | undefined,
  fileUnpaused: Record<string, string> | undefined
): { pausedActivities: Record<string, string>; unpausedActivities: Record<string, string> } => {
  const paused = { ...(memPaused || {}) };
  const unpaused = { ...(fileUnpaused || {}), ...(memUnpaused || {}) };
  for (const [id, date] of Object.entries(filePaused || {})) {
    const unpausedAt = unpaused[id];
    if (unpausedAt && unpausedAt >= date) continue;
    if (!paused[id] || date < paused[id]) paused[id] = date;
  }
  for (const [id, unpausedAt] of Object.entries(unpaused)) {
    if (paused[id] && unpausedAt >= paused[id]) delete paused[id];
  }
  return { pausedActivities: paused, unpausedActivities: unpaused };
};


export const lastLogDayForActivity = (logs: StreakData['logs'], activityId: string): string | null => {
  let last: string | null = null;
  for (const day of Object.keys(logs || {})) {
    if (logs[day]?.[activityId] && (!last || day > last)) last = day;
  }
  return last;
};

export const dayAfter = (dayStr: string): string => {
  const d = parseDate(dayStr);
  d.setDate(d.getDate() + 1);
  return formatDate(d);
};

export const backfillArchivedAt = (config: StreakConfig, data: StreakData): boolean => {
  let changed = false;
  for (const activity of config.archivedActivities || []) {
    if (activity.archivedAt) continue;
    const last = lastLogDayForActivity(data.logs, activity.id);
    activity.archivedAt = last ? dayAfter(last) : null;
    changed = true;
  }
  return changed;
};


const normalizeActivity = (raw: unknown): StreakActivity | null => {
  if (!raw || typeof raw !== 'object' || typeof (raw as StreakActivity).id !== 'string') return null;
  const a = raw as StreakActivity;
  return {
    id: a.id,
    name: typeof a.name === 'string' ? a.name : undefined,
    description: typeof a.description === 'string' ? a.description : undefined,
    frequency: a.frequency === 'weekly' ? 'weekly' : a.frequency === 'daily' ? 'daily' : undefined,
    weeklyTarget: typeof a.weeklyTarget === 'number' ? a.weeklyTarget : undefined,
    scheduledDays: Array.isArray(a.scheduledDays) ? a.scheduledDays.filter((d) => typeof d === 'string') : undefined,
    canFail: !!a.canFail,
    necessary: !!a.necessary,
    archivedAt: typeof a.archivedAt === 'string' ? a.archivedAt : a.archivedAt === null ? null : undefined,
    linkedStapleId: typeof a.linkedStapleId === 'string' && a.linkedStapleId.trim() ? a.linkedStapleId.trim() : undefined,
    linkedWater: !!a.linkedWater,
    linkedMovementBurst: !!a.linkedMovementBurst,
    extraCalories: typeof a.extraCalories === 'number' && a.extraCalories > 0 ? a.extraCalories : undefined,
    extraProtein: typeof a.extraProtein === 'number' && a.extraProtein > 0 ? a.extraProtein : undefined,
    extraWaterMl: typeof a.extraWaterMl === 'number' && a.extraWaterMl > 0 ? a.extraWaterMl : undefined
  };
};

export const normalizeConfig = (raw: unknown): StreakConfig => {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    activities: Array.isArray(data.activities) ? data.activities.map(normalizeActivity).filter((x): x is StreakActivity => x !== null) : [],
    archivedActivities: Array.isArray(data.archivedActivities) ? data.archivedActivities.map(normalizeActivity).filter((x): x is StreakActivity => x !== null) : []
  };
};

export const normalizeDataPayload = (raw: unknown): Omit<StreakData, 'stats'> => {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    logs: normalizeLogs(data.logs as StreakData['logs']),
    activityStartDates: data.activityStartDates && typeof data.activityStartDates === 'object' ? { ...(data.activityStartDates as Record<string, string>) } : {},
    pausedActivities: data.pausedActivities && typeof data.pausedActivities === 'object' ? { ...(data.pausedActivities as Record<string, string>) } : {},
    unpausedActivities: data.unpausedActivities && typeof data.unpausedActivities === 'object' ? { ...(data.unpausedActivities as Record<string, string>) } : {},
    activityResetCounts: data.activityResetCounts && typeof data.activityResetCounts === 'object' ? { ...(data.activityResetCounts as Record<string, number>) } : {}
  };
};
