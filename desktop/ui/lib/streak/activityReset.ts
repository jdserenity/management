import { getLogState } from '@/lib/streak/logs';
import type { StreakData } from '@/lib/streak/types';

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
