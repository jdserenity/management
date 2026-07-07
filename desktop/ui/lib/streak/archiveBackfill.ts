import { parseDate, formatDate } from '@/lib/streak/dates';
import type { StreakConfig, StreakData } from '@/lib/streak/types';

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
