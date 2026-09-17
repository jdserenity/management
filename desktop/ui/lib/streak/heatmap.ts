import { getLogState } from '@/lib/streak/logs';
import { isActivityActiveOnDay } from '@/lib/streak/activityCatalog';
import { formatDate } from '@/lib/streak/dates';
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

/**
 * A necessary daily task that is active but not success fails the whole day.
 * Only applies to days that have already started (≤ today) — future days are not failures.
 */
export const isDayNecessaryFailed = (
  data: StreakData,
  activities: StreakActivity[],
  dayStr: string,
  todayStr?: string
): boolean => {
  if (todayStr && dayStr > todayStr) return false;
  const log = data.logs[dayStr] || {};
  for (const activity of activities) {
    if (!activity.necessary) continue;
    if (activity.frequency === 'weekly') continue;
    if (!isActivityActiveOnDay(activity, data, dayStr)) continue;
    if (getLogState(log[activity.id]) !== 'success') return true;
  }
  return false;
};

/** Calendar cells for a month, Sunday-first, padded to six complete weeks. */
export const getMonthCalendarDates = (month: string): (string | null)[] => {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < 42; i++) {
    const dayNumber = i - firstDay.getDay() + 1;
    cells.push(dayNumber >= 1 && dayNumber <= daysInMonth ? formatDate(new Date(year, monthNumber - 1, dayNumber)) : null);
  }
  return cells;
};

export const getCalendarMonthsWithData = (data: StreakData, currentMonth: string): string[] => {
  const months = new Set<string>([currentMonth]);
  for (const dateStr of Object.keys(data.logs || {})) months.add(dateStr.slice(0, 7));
  for (const dateStr of Object.values(data.activityStartDates || {})) months.add(dateStr.slice(0, 7));
  return [...months].sort();
};
