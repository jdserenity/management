import { getLogState } from '@/lib/streak/logs';
import type { StreakActivity, StreakState } from '@/lib/streak/types';
import { loadStreakState, saveStreakLog } from '@/lib/streakDb';

/** True when this activity is networked to the given nutrition staple id. */
export const activityLinksToStaple = (activity: StreakActivity, stapleId: string): boolean => {
  if (!stapleId) return false;
  const linked = (activity.linkedStapleId || '').trim();
  return linked.length > 0 && linked === stapleId;
};

const completeMatching = async (
  pred: (a: StreakActivity) => boolean
): Promise<StreakState | null> => {
  let state = await loadStreakState();
  const day = state.currentDay;
  let changed = false;
  for (const activity of state.config.activities) {
    if (!pred(activity)) continue;
    if (getLogState(state.data.logs[day]?.[activity.id]) === 'success') continue;
    state = await saveStreakLog(state, activity.id, 'success', day);
    changed = true;
  }
  return changed ? state : null;
};

const uncompleteMatching = async (
  pred: (a: StreakActivity) => boolean
): Promise<StreakState | null> => {
  let state = await loadStreakState();
  const day = state.currentDay;
  let changed = false;
  for (const activity of state.config.activities) {
    if (!pred(activity)) continue;
    if (getLogState(state.data.logs[day]?.[activity.id]) !== 'success') continue;
    state = await saveStreakLog(state, activity.id, null, day);
    changed = true;
  }
  return changed ? state : null;
};

/** Complete every uncompleted task linked to this nutrition staple (same day). */
export const completeTasksLinkedToStaple = async (stapleId: string): Promise<StreakState | null> => {
  if (!stapleId) return null;
  return completeMatching((a) => activityLinksToStaple(a, stapleId));
};

/** Uncomplete tasks linked to this staple (same day) — staple was removed. */
export const uncompleteTasksLinkedToStaple = async (stapleId: string): Promise<StreakState | null> => {
  if (!stapleId) return null;
  return uncompleteMatching((a) => activityLinksToStaple(a, stapleId));
};

/** Complete every uncompleted task linked to the water tracker (same day). */
export const completeTasksLinkedToWater = async (): Promise<StreakState | null> =>
  completeMatching((a) => !!a.linkedWater);

/** Uncomplete water-linked tasks (e.g. all water for the day was cleared). */
export const uncompleteTasksLinkedToWater = async (): Promise<StreakState | null> =>
  uncompleteMatching((a) => !!a.linkedWater);

/** Complete tasks linked to movement bursts (at least one burst logged today). */
export const completeTasksLinkedToMovementBurst = async (): Promise<StreakState | null> =>
  completeMatching((a) => !!a.linkedMovementBurst);

/** Uncomplete burst-linked tasks (no bursts left today). */
export const uncompleteTasksLinkedToMovementBurst = async (): Promise<StreakState | null> =>
  uncompleteMatching((a) => !!a.linkedMovementBurst);
