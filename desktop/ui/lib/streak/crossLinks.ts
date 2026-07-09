import { getLogState } from '@/lib/streak/logs';
import type { StreakState } from '@/lib/streak/types';
import { loadStreakState, saveStreakLog } from '@/lib/streakDb';

/** Complete every uncompleted task linked to this nutrition staple (same day). */
export const completeTasksLinkedToStaple = async (stapleId: string): Promise<StreakState | null> => {
  if (!stapleId) return null;
  let state = await loadStreakState();
  const day = state.currentDay;
  let changed = false;
  for (const activity of state.config.activities) {
    if (activity.linkedStapleId !== stapleId) continue;
    if (getLogState(state.data.logs[day]?.[activity.id]) === 'success') continue;
    state = await saveStreakLog(state, activity.id, 'success', day);
    changed = true;
  }
  return changed ? state : null;
};

/** Complete every uncompleted task linked to the water tracker (same day). */
export const completeTasksLinkedToWater = async (): Promise<StreakState | null> => {
  let state = await loadStreakState();
  const day = state.currentDay;
  let changed = false;
  for (const activity of state.config.activities) {
    if (!activity.linkedWater) continue;
    if (getLogState(state.data.logs[day]?.[activity.id]) === 'success') continue;
    state = await saveStreakLog(state, activity.id, 'success', day);
    changed = true;
  }
  return changed ? state : null;
};
