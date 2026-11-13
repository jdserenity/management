import { clampDayRolloverHour, DEFAULT_DAY_ROLLOVER_HOUR } from '@/lib/dayBoundary';

export const formatLogDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** YYYY-MM-DD log day using Management stats rollover hour (default 4 AM). */
export const getCurrentLogDay = (
  now: Date = new Date(),
  rolloverHour: number = DEFAULT_DAY_ROLLOVER_HOUR
): string => {
  const hour = clampDayRolloverHour(rolloverHour);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = hour * 60;
  if (currentMinutes < endMinutes) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatLogDay(yesterday);
  }
  return formatLogDay(now);
};

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC midnight shifting the day). */
export const parseLocalLogDay = (day: string): Date => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Inclusive window of log days ending at `endDay`, oldest → newest. */
export const recentLogDays = (endDay: string, count: number): string[] => {
  const n = Math.max(0, Math.floor(count));
  if (!n) return [];
  const end = parseLocalLogDay(endDay);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(formatLogDay(d));
  }
  return out;
};
