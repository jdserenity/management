import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadStreakState, saveStreakLog } = vi.hoisted(() => ({
  loadStreakState: vi.fn(),
  saveStreakLog: vi.fn()
}));

vi.mock('@/lib/streakDb', () => ({ loadStreakState, saveStreakLog }));

import {
  activityLinksToStaple,
  completeTasksLinkedToMovementBurst,
  completeTasksLinkedToStaple,
  completeTasksLinkedToWater,
  uncompleteTasksLinkedToMovementBurst,
  uncompleteTasksLinkedToStaple,
  uncompleteTasksLinkedToWater
} from '@/lib/streak/crossLinks';
import type { StreakState } from '@/lib/streak/types';

const baseState = (): StreakState => ({
  currentDay: '2026-07-07',
  config: {
    activities: [
      { id: 'oil', name: 'Olive oil', linkedStapleId: 'olive-oil' },
      { id: 'water', name: 'Water', linkedWater: true },
      { id: 'burst', name: 'First burst', linkedMovementBurst: true },
      { id: 'other', name: 'Other' }
    ],
    archivedActivities: []
  },
  data: {
    logs: {},
    activityStartDates: { oil: '2026-07-01', water: '2026-07-01', burst: '2026-07-01', other: '2026-07-01' },
    pausedActivities: {},
    unpausedActivities: {},
    activityResetCounts: {},
    stats: {}
  },
  activityConfigMap: {}
});

describe('crossLinks', () => {
  beforeEach(() => {
    loadStreakState.mockReset();
    saveStreakLog.mockReset();
  });

  it('activityLinksToStaple matches trimmed linkedStapleId', () => {
    expect(activityLinksToStaple({ id: 'oil', linkedStapleId: 'olive-oil' }, 'olive-oil')).toBe(true);
    expect(activityLinksToStaple({ id: 'oil', linkedStapleId: ' eggs ' }, 'eggs')).toBe(true);
    expect(activityLinksToStaple({ id: 'oil', linkedStapleId: 'peanuts' }, 'eggs')).toBe(false);
    expect(activityLinksToStaple({ id: 'oil' }, 'olive-oil')).toBe(false);
  });

  it('completeTasksLinkedToStaple marks linked incomplete tasks success', async () => {
    const state = baseState();
    loadStreakState.mockResolvedValue(state);
    const after = {
      ...state,
      data: {
        ...state.data,
        logs: { '2026-07-07': { oil: { state: 'success' as const, updatedAt: 'x' } } }
      }
    };
    saveStreakLog.mockResolvedValue(after);
    const result = await completeTasksLinkedToStaple('olive-oil');
    expect(saveStreakLog).toHaveBeenCalledWith(state, 'oil', 'success', '2026-07-07');
    expect(result).toBe(after);
  });

  it('uncompleteTasksLinkedToStaple clears linked success', async () => {
    const state = baseState();
    state.data.logs = { '2026-07-07': { oil: { state: 'success', updatedAt: 'x' } } };
    loadStreakState.mockResolvedValue(state);
    saveStreakLog.mockResolvedValue(state);
    await uncompleteTasksLinkedToStaple('olive-oil');
    expect(saveStreakLog).toHaveBeenCalledWith(state, 'oil', null, '2026-07-07');
  });

  it('completeTasksLinkedToWater marks water-linked tasks', async () => {
    const state = baseState();
    loadStreakState.mockResolvedValue(state);
    saveStreakLog.mockResolvedValue(state);
    await completeTasksLinkedToWater();
    expect(saveStreakLog).toHaveBeenCalledWith(state, 'water', 'success', '2026-07-07');
  });

  it('uncompleteTasksLinkedToWater clears water-linked tasks', async () => {
    const state = baseState();
    state.data.logs = { '2026-07-07': { water: { state: 'success', updatedAt: 'x' } } };
    loadStreakState.mockResolvedValue(state);
    saveStreakLog.mockResolvedValue(state);
    await uncompleteTasksLinkedToWater();
    expect(saveStreakLog).toHaveBeenCalledWith(state, 'water', null, '2026-07-07');
  });

  it('complete and uncomplete movement-burst-linked tasks', async () => {
    const state = baseState();
    loadStreakState.mockResolvedValue(state);
    saveStreakLog.mockResolvedValue(state);
    await completeTasksLinkedToMovementBurst();
    expect(saveStreakLog).toHaveBeenCalledWith(state, 'burst', 'success', '2026-07-07');
    state.data.logs = { '2026-07-07': { burst: { state: 'success', updatedAt: 'x' } } };
    await uncompleteTasksLinkedToMovementBurst();
    expect(saveStreakLog).toHaveBeenCalledWith(expect.anything(), 'burst', null, '2026-07-07');
  });
});
