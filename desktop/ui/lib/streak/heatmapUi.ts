import type { StreakActivity, StreakData } from '@/lib/streak/types';
import { getLogState } from '@/lib/streak/logs';

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
