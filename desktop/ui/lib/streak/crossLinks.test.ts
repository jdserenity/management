import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadStreakState, saveStreakLog } = vi.hoisted(() => ({
  loadStreakState: vi.fn(),
  saveStreakLog: vi.fn()
}));

vi.mock('@/lib/streakDb', () => ({ loadStreakState, saveStreakLog }));

import { activityLinksToStaple, completeTasksLinkedToStaple, completeTasksLinkedToWater } from '@/lib/streak/crossLinks';
import type { StreakState } from '@/lib/streak/types';

const baseState = (overrides?: Partial<StreakState['config']>): StreakState => ({
  currentDay: '2026-07-07',
  config: {
    activities: [
      { id: 'oil', name: 'Olive oil', linkedStapleId: 'olive-oil' },
      { id: 'water', name: 'Water', linkedWater: true },
      { id: 'other', name: 'Other' }
    ],
    archivedActivities: [],
    ...overrides
  },
  data: {
    logs: {},
    activityStartDates: { oil: '2026-07-01', water: '2026-07-01', other: '2026-07-01' },
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

  it('completeTasksLinkedToStaple no-ops when already success', async () => {
    const state = baseState();
    state.data.logs = { '2026-07-07': { oil: { state: 'success', updatedAt: 'x' } } };
    loadStreakState.mockResolvedValue(state);
    const result = await completeTasksLinkedToStaple('olive-oil');
    expect(saveStreakLog).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('completeTasksLinkedToWater marks water-linked tasks', async () => {
    const state = baseState();
    loadStreakState.mockResolvedValue(state);
    const after = { ...state };
    saveStreakLog.mockResolvedValue(after);
    await completeTasksLinkedToWater();
    expect(saveStreakLog).toHaveBeenCalledWith(state, 'water', 'success', '2026-07-07');
  });
});
