import { normalizeLogs } from '@/lib/streak/logs';
import type { StreakActivity, StreakConfig, StreakData } from '@/lib/streak/types';

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
    archivedAt: typeof a.archivedAt === 'string' ? a.archivedAt : a.archivedAt === null ? null : undefined,
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
