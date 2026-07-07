import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreakState } from '@/lib/streak/types';
import { archiveStreakActivity, saveStreakLog } from '@/lib/streakDb';

const { executeCalls, activityRows, logRows, metaRows } = vi.hoisted(() => ({
  executeCalls: [] as string[],
  activityRows: new Map<string, Record<string, unknown>>(),
  logRows: new Map<string, Record<string, unknown>>(),
  metaRows: new Map<string, Record<string, unknown>>()
}));

vi.mock('@/lib/dayBoundaryPref', () => ({
  loadDayRolloverHourPref: vi.fn(async () => 4)
}));

vi.mock('@/lib/db', () => ({
  getDb: async () => ({
    select: async <T>(sql: string): Promise<T> => {
      if (sql.includes('FROM streak_activities')) {
        return [...activityRows.values()] as T;
      }
      if (sql.includes('FROM streak_log_cells')) {
        return [...logRows.values()] as T;
      }
      if (sql.includes('FROM streak_activity_meta')) {
        return [...metaRows.values()] as T;
      }
      return [] as T;
    },
    execute: async (sql: string, params: unknown[] = []) => {
      executeCalls.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('INSERT INTO streak_activities')) {
        activityRows.set(String(params[0]), {
          id: params[0],
          name: params[1],
          archived_at: params[7],
          sort_order: params[8],
          updated_at: params[12]
        });
      }
      if (sql.includes('INSERT INTO streak_log_cells')) {
        logRows.set(`${params[0]}:${params[1]}`, {
          log_date: params[0],
          activity_id: params[1],
          state: params[2],
          updated_at: params[3]
        });
      }
      if (sql.includes('INSERT INTO streak_activity_meta')) {
        metaRows.set(String(params[0]), {
          activity_id: params[0],
          start_date: params[1],
          pause_since: params[2],
          unpaused_at: params[3],
          reset_count: params[4],
          updated_at: params[5]
        });
      }
      if (sql.startsWith('DELETE FROM streak_log_cells WHERE log_date')) {
        logRows.delete(`${params[0]}:${params[1]}`);
      }
    }
  })
}));

const baseState = (): StreakState => ({
  currentDay: '2026-07-07',
  config: {
    activities: [{ id: 'run', name: 'Run', frequency: 'daily', canFail: false }],
    archivedActivities: []
  },
  data: {
    logs: {},
    activityStartDates: { run: '2026-07-01' },
    pausedActivities: {},
    unpausedActivities: {},
    activityResetCounts: {},
    stats: {}
  },
  activityConfigMap: {}
});

describe('streakDb row-level saves', () => {
  beforeEach(() => {
    executeCalls.length = 0;
    activityRows.clear();
    logRows.clear();
    metaRows.clear();
    activityRows.set('run', {
      id: 'run',
      name: 'Run',
      description: null,
      frequency: 'daily',
      weekly_target: null,
      scheduled_days_json: null,
      can_fail: 0,
      archived_at: null,
      sort_order: 0,
      extra_calories: null,
      extra_protein: null,
      extra_water_ml: null,
      updated_at: '2026-07-01T00:00:00.000Z'
    });
  });

  it('archiveStreakActivity upserts one activity row instead of wiping the table', async () => {
    await archiveStreakActivity(baseState(), 'run');
    expect(executeCalls.some((sql) => sql === 'DELETE FROM streak_activities')).toBe(false);
    expect(executeCalls.filter((sql) => sql.startsWith('INSERT INTO streak_activities'))).toHaveLength(1);
    expect(activityRows.get('run')?.archived_at).toBe('2026-07-07');
    expect(activityRows.get('run')?.updated_at).toBeTruthy();
  });

  it('saveStreakLog upserts one log cell instead of rewriting all logs', async () => {
    await saveStreakLog(baseState(), 'run', 'success');
    expect(executeCalls.some((sql) => sql === 'DELETE FROM streak_log_cells')).toBe(false);
    expect(executeCalls.filter((sql) => sql.startsWith('INSERT INTO streak_log_cells'))).toHaveLength(1);
    expect(logRows.get('2026-07-07:run')?.state).toBe('success');
  });
});
