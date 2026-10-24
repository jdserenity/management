import { getLogState } from '@/lib/streak/logs';
import { isActivityActiveOnDay } from '@/lib/streak/activityCatalog';
import { formatDate, parseDate } from '@/lib/streak/dates';
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
    // Tracker-linked (water/food/workout) count like every other habit: active
    // that day and success in the log. Skipping them on past days was a hack
    // that handed out false calendar X's when water/food/workout weren't done.
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

/** Unbroken-chain "mode" needs more than one consecutive complete day. */
export const UNBROKEN_CHAIN_MODE_MIN_DAYS = 2;

const previousDayStr = (dayStr: string): string => {
  const d = parseDate(dayStr);
  d.setDate(d.getDate() - 1);
  return formatDate(d);
};

/**
 * Consecutive complete calendar days ending at today (or yesterday if today has no X yet).
 * Today without an X does not break the chain — the day is still in progress.
 * A past incomplete day ends the chain.
 */
export const getUnbrokenChainDates = (
  data: StreakData,
  activities: StreakActivity[],
  todayStr: string
): string[] => {
  const dates: string[] = [];
  let cursor = isDayComplete(data, activities, todayStr) ? todayStr : previousDayStr(todayStr);
  // Bound the walk so a sparse history cannot loop forever.
  for (let i = 0; i < 2000; i++) {
    if (!isDayComplete(data, activities, cursor)) break;
    dates.push(cursor);
    cursor = previousDayStr(cursor);
  }
  return dates;
};

export const isUnbrokenChainMode = (chainDates: readonly string[]): boolean =>
  chainDates.length >= UNBROKEN_CHAIN_MODE_MIN_DAYS;

/** True only when a change flips the day from incomplete to complete — the moment to celebrate. */
export const becameDayComplete = (
  prevData: StreakData, prevActivities: StreakActivity[],
  nextData: StreakData, nextActivities: StreakActivity[],
  dayStr: string
): boolean => !isDayComplete(prevData, prevActivities, dayStr) && isDayComplete(nextData, nextActivities, dayStr);

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

/** Calendar cells for a month, Sunday-first, full weeks only (no blank trailing week under the last days). */
export const getMonthCalendarDates = (month: string): (string | null)[] => {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < 42; i++) {
    const dayNumber = i - firstDay.getDay() + 1;
    cells.push(dayNumber >= 1 && dayNumber <= daysInMonth ? formatDate(new Date(year, monthNumber - 1, dayNumber)) : null);
  }
  // Six-week padding left an empty row after months that end mid-grid (e.g. Oct 2026),
  // which looked like a huge gap before the Food/Water widgets.
  while (cells.length > 7 && cells.slice(-7).every((cell) => cell == null)) cells.length -= 7;
  return cells;
};

export const getCalendarMonthsWithData = (data: StreakData, currentMonth: string): string[] => {
  const months = new Set<string>([currentMonth]);
  for (const dateStr of Object.keys(data.logs || {})) months.add(dateStr.slice(0, 7));
  for (const dateStr of Object.values(data.activityStartDates || {})) months.add(dateStr.slice(0, 7));
  return [...months].sort();
};
