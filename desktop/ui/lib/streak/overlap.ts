import type { StreakActivity } from '@/lib/streak/types';

/** Humanize a staple id like olive-oil → olive oil for subtle badges. */
export const labelFromStapleId = (stapleId: string): string =>
  stapleId.replace(/[-_]+/g, ' ').trim() || stapleId;

export const formatOverlapBadge = (activity: StreakActivity): string | null => {
  const parts: string[] = [];
  if (activity.necessary) parts.push('necessary');
  if (activity.linkedStapleId) parts.push(`🍽 ${labelFromStapleId(activity.linkedStapleId)}`);
  if (activity.linkedWater) parts.push('💧 water');
  if (activity.extraCalories) parts.push(`${activity.extraCalories} kcal`);
  if (activity.extraProtein) parts.push(`${activity.extraProtein}g protein`);
  if (activity.extraWaterMl) parts.push(`${activity.extraWaterMl} ml`);
  return parts.length ? parts.join(' · ') : null;
};

export const hasOverlapLogging = (activity: StreakActivity): boolean =>
  !!(activity.extraCalories || activity.extraProtein || activity.extraWaterMl || activity.linkedStapleId || activity.linkedWater);
