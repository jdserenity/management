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

/**
 * A necessary daily task that is active but not success fails the whole day
 * (heatmap shows red with an X instead of any green shade).
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

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const monthIndexFromDateStr = (dateStr: string | null | undefined): number => {
  if (!dateStr) return -1;
  return parseInt(dateStr.slice(5, 7), 10) - 1;
};

export const weekColumnMonthFromDates = (dateStrs: (string | null | undefined)[]): number => {
  for (const d of dateStrs) {
    const m = monthIndexFromDateStr(d);
    if (m >= 0) return m;
  }
  return -1;
};

export const heatmapMonthSpans = (weekMonths: number[]): { name: string; weekCount: number }[] => {
  const spans: { name: string; weekCount: number }[] = [];
  let i = 0;
  while (i < weekMonths.length) {
    const m = weekMonths[i];
    if (m < 0) { i++; continue; }
    const start = i;
    while (i < weekMonths.length && weekMonths[i] === m) i++;
    spans.push({ name: MONTH_NAMES[m], weekCount: i - start });
  }
  return spans;
};

export const getYearsWithData = (data: StreakData): number[] => {
  const years = new Set<number>();
  years.add(new Date().getFullYear());
  for (const dateStr of Object.keys(data.logs)) years.add(parseInt(dateStr.split('-')[0], 10));
  return [...years].sort((a, b) => b - a);
};

export const getWeeklyYearsWithData = (data: StreakData, weeklyActivities: StreakActivity[]): number[] => {
  const years = new Set<number>();
  years.add(new Date().getFullYear());
  for (const activity of weeklyActivities) {
    const startDate = data.activityStartDates[activity.id];
    if (startDate) years.add(parseInt(startDate.split('-')[0], 10));
  }
  for (const dateStr of Object.keys(data.logs)) {
    const log = data.logs[dateStr];
    const y = parseInt(dateStr.split('-')[0], 10);
    for (const activity of weeklyActivities) {
      if (getLogState(log[activity.id]) != null) { years.add(y); break; }
    }
  }
  return [...years].sort((a, b) => b - a);
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const heatmapLevel = (successCount: number, historicalCount: number): number => {
  if (historicalCount <= 0) return 0;
  const percentage = (successCount / historicalCount) * 100;
  if (percentage === 100) return 5;
  if (percentage >= 76) return 4;
  if (percentage >= 51) return 3;
  if (percentage >= 26) return 2;
  if (percentage >= 1) return 1;
  return 0;
};
