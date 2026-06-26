import type { StreakActivity } from '@/lib/streak/types';

export const formatOverlapBadge = (activity: StreakActivity): string | null => {
  const parts: string[] = [];
  if (activity.extraCalories) parts.push(`${activity.extraCalories} kcal`);
  if (activity.extraProtein) parts.push(`${activity.extraProtein}g protein`);
  if (activity.extraWaterMl) parts.push(`${activity.extraWaterMl} ml`);
  return parts.length ? parts.join(' · ') : null;
};

export const hasOverlapLogging = (activity: StreakActivity): boolean =>
  !!(activity.extraCalories || activity.extraProtein || activity.extraWaterMl);
