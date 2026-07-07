import { getLogState } from '@/lib/streak/logs';
import { isActivityActiveOnDay } from '@/lib/streak/activityCatalog';
import type { StreakActivity, StreakData } from '@/lib/streak/types';

export const isPerfectHeatmapCell = (done: number, total: number): boolean => total > 0 && done === total;

export const getDayCompletionCounts = (
  data: StreakData,
  activities: StreakActivity[],
  dayStr: string
): { successCount: number; historicalCount: number } => {
  let successCount = 0;
  let historicalCount = 0;
  const log = data.logs[dayStr] || {};
  for (const activity of activities) {
    if (!isActivityActiveOnDay(activity, data, dayStr)) continue;
    historicalCount++;
    if (getLogState(log[activity.id]) === 'success') successCount++;
  }
  return { successCount, historicalCount };
};

export const isDayComplete = (data: StreakData, activities: StreakActivity[], dayStr: string): boolean => {
  const { successCount, historicalCount } = getDayCompletionCounts(data, activities, dayStr);
  return isPerfectHeatmapCell(successCount, historicalCount);
};
