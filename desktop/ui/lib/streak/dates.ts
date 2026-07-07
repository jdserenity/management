import { clampDayRolloverHour, DEFAULT_DAY_ROLLOVER_HOUR } from '@/lib/dayBoundary';

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const daysBetween = (date1: string, date2: string): number => {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

export const dayEndTimeFromRolloverHour = (rolloverHour: number = DEFAULT_DAY_ROLLOVER_HOUR): string =>
  `${String(clampDayRolloverHour(rolloverHour)).padStart(2, '0')}:00`;

export const getCurrentDay = (dayEndTime = '04:00', now: Date = new Date()): string => {
  const [endHour, endMinute] = dayEndTime.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = endHour * 60 + endMinute;
  if (currentMinutes < endMinutes) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return formatDate(yesterday);
  }
  return formatDate(now);
};

export const getISOWeekStart = (dateStr: string): string => {
  const d = parseDate(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
};

export const getWeekDays = (weekStartStr: string): string[] => {
  const days: string[] = [];
  const d = parseDate(weekStartStr);
  for (let i = 0; i < 7; i++) {
    days.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
};

export const isDateInWeek = (weekStartStr: string, dateStr: string): boolean => {
  const days = getWeekDays(weekStartStr);
  return dateStr >= days[0] && dateStr <= days[6];
};
