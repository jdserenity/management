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
