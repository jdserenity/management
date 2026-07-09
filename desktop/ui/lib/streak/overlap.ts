import type { StreakActivity } from '@/lib/streak/types';

/** Humanize a staple id like olive-oil → olive oil for subtle badges. */
export const labelFromStapleId = (stapleId: string): string =>
  stapleId.replace(/[-_]+/g, ' ').trim() || stapleId;

export type OverlapBadgePart =
  | { kind: 'necessary'; text: 'necessary' }
  | { kind: 'link' | 'extra'; text: string };

export const getOverlapBadgeParts = (activity: StreakActivity): OverlapBadgePart[] => {
  const parts: OverlapBadgePart[] = [];
  if (activity.necessary) parts.push({ kind: 'necessary', text: 'necessary' });
  if (activity.linkedStapleId) parts.push({ kind: 'link', text: labelFromStapleId(activity.linkedStapleId) });
  if (activity.linkedWater) parts.push({ kind: 'link', text: 'water' });
  if (activity.linkedMovementBurst) parts.push({ kind: 'link', text: 'burst' });
  if (activity.extraCalories) parts.push({ kind: 'extra', text: `${activity.extraCalories} kcal` });
  if (activity.extraProtein) parts.push({ kind: 'extra', text: `${activity.extraProtein}g protein` });
  if (activity.extraWaterMl) parts.push({ kind: 'extra', text: `${activity.extraWaterMl} ml` });
  return parts;
};

/** Flat string form (tests / tooltips). */
export const formatOverlapBadge = (activity: StreakActivity): string | null => {
  const parts = getOverlapBadgeParts(activity);
  return parts.length ? parts.map((p) => p.text).join(' · ') : null;
};

export const hasOverlapLogging = (activity: StreakActivity): boolean =>
  !!(
    activity.extraCalories ||
    activity.extraProtein ||
    activity.extraWaterMl ||
    activity.linkedStapleId ||
    activity.linkedWater ||
    activity.linkedMovementBurst
  );
