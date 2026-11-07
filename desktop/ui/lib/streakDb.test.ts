import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreakState } from '@/lib/streak/types';
import { applyStreakLogLocally, archiveStreakActivity, deleteStreakCategory, reconcileTrackerLinkedStreakActivities, reorderStreakActivities, saveStreakLog, setTrackerLinkedStreakTaskEnabled, upsertStreakCategory } from '@/lib/streakDb';

const { executeCalls, activityRows, categoryRows, logRows, metaRows } = vi.hoisted(() => ({
  executeCalls: [] as string[],
  activityRows: new Map<string, Record<string, unknown>>(),
  categoryRows: new Map<string, Record<string, unknown>>(),
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
      if (sql.includes('FROM streak_categories')) {
        return [...categoryRows.values()] as T;
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
          description: params[2],
          frequency: params[3],
          weekly_target: params[4],
          scheduled_days_json: params[5],
          can_fail: params[6],
          necessary: params[7],
          archived_at: params[8],
          sort_order: params[9],
          linked_staple_id: params[10],
          linked_water: params[11],
          linked_movement_burst: params[12],
          extra_calories: params[13],
          extra_protein: params[14],
          extra_water_ml: params[15],
          automatic_kind: params[16],
          enabled: params[17],
          category_id: params[18],
          updated_at: params[19]
        });
      }
      if (sql.includes('INSERT INTO streak_categories')) {
        categoryRows.set(String(params[0]), {
          id: params[0],
          name: params[1],
          sort_order: params[2],
          updated_at: params[3]
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
      if (sql.startsWith('DELETE FROM streak_categories WHERE id=')) {
        categoryRows.delete(String(params[0]));
      }
    }
  })
}));

const baseState = (): StreakState => ({
  currentDay: '2026-07-07',
  config: {
    activities: [{ id: 'run', name: 'Run', frequency: 'daily', canFail: false }],
    archivedActivities: [],
    categories: []
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
    categoryRows.clear();
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
      necessary: 0,
      archived_at: null,
      sort_order: 0,
      linked_staple_id: null,
      linked_water: 0,
      linked_movement_burst: 0,
      extra_calories: null,
      extra_protein: null,
      extra_water_ml: null,
      automatic_kind: null,
      enabled: 1,
      category_id: null,
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

  it('applyStreakLogLocally shows the check in memory without touching the DB or the old state', () => {
    const state = baseState();
    const next = applyStreakLogLocally(state, 'run', 'success', undefined, '04:00');
    expect(next.data.logs['2026-07-07']?.run?.state).toBe('success');
    expect(state.data.logs['2026-07-07']?.run).toBeUndefined();
    expect(executeCalls).toHaveLength(0);
    const cleared = applyStreakLogLocally(next, 'run', null, undefined, '04:00');
    expect(cleared.data.logs['2026-07-07']?.run?.state).toBe('none');
  });

  it('saveStreakLog and the optimistic preview agree on the saved cell', async () => {
    const state = baseState();
    const optimistic = applyStreakLogLocally(state, 'run', 'success', undefined, '04:00');
    const saved = await saveStreakLog(state, 'run', 'success');
    expect(saved.data.logs['2026-07-07']?.run?.state).toBe(optimistic.data.logs['2026-07-07']?.run?.state);
    expect(state.data.logs['2026-07-07']?.run).toBeUndefined();
  });

  it('reorderStreakActivities writes sort_order for each active row', async () => {
    activityRows.set('lift', {
      id: 'lift',
      name: 'Lift',
      description: null,
      frequency: 'daily',
      weekly_target: null,
      scheduled_days_json: null,
      can_fail: 0,
      necessary: 0,
      archived_at: null,
      sort_order: 1,
      linked_staple_id: null,
      linked_water: 0,
      linked_movement_burst: 0,
      extra_calories: null,
      extra_protein: null,
      extra_water_ml: null,
      automatic_kind: null,
      enabled: 1,
      category_id: null,
      updated_at: '2026-07-01T00:00:00.000Z'
    });
    const state = baseState();
    state.config.activities = [
      { id: 'run', name: 'Run', frequency: 'daily', canFail: false },
      { id: 'lift', name: 'Lift', frequency: 'daily', canFail: false }
    ];
    const next = await reorderStreakActivities(state, ['lift', 'run']);
    expect(next.config.activities.map((a) => a.id)).toEqual(['lift', 'run']);
    expect(activityRows.get('lift')?.sort_order).toBe(0);
    expect(activityRows.get('run')?.sort_order).toBe(1);
  });

  it('reconciles an enabled tracker-linked task from its tracker threshold', async () => {
    const state = baseState();
    state.config.activities = [{ id: 'automatic-water', name: 'Water goal', frequency: 'daily', trackerLinkedKind: 'water' }];
    state.data.activityStartDates = { 'automatic-water': '2026-07-07' };
    const complete = await reconcileTrackerLinkedStreakActivities(state, { water: { totalMl: 2000, targetMl: 2000 } });
    expect(complete.data.logs['2026-07-07']?.['automatic-water']?.state).toBe('success');
    const incomplete = await reconcileTrackerLinkedStreakActivities(complete, { water: { totalMl: 1999, targetMl: 2000 } });
    expect(incomplete.data.logs['2026-07-07']?.['automatic-water']?.state).toBe('none');
  });

  it('creates an enabled tracker-linked task in the sortable activity list', async () => {
    const next = await setTrackerLinkedStreakTaskEnabled(baseState(), 'water', true);
    expect(next.config.activities.map((activity) => activity.id)).toContain('automatic-water');
    expect(activityRows.get('automatic-water')?.automatic_kind).toBe('water');
    expect(activityRows.get('automatic-water')?.enabled).toBe(1);
  });

  it('upsertStreakCategory inserts a category row and delete clears membership', async () => {
    const withCat = await upsertStreakCategory(baseState(), { name: 'French' }, true);
    expect(withCat.config.categories.map((c) => c.id)).toContain('french');
    expect(categoryRows.get('french')?.name).toBe('French');
    const state = baseState();
    state.config.categories = [{ id: 'french', name: 'French' }];
    state.config.activities = [{ id: 'run', name: 'Run', frequency: 'daily', canFail: false, categoryId: 'french' }];
    categoryRows.set('french', { id: 'french', name: 'French', sort_order: 0, updated_at: 'x' });
    const cleared = await deleteStreakCategory(state, 'french');
    expect(cleared.config.categories).toEqual([]);
    expect(cleared.config.activities[0]?.categoryId).toBeUndefined();
    expect(activityRows.get('run')?.category_id).toBeNull();
    expect(categoryRows.has('french')).toBe(false);
  });
});
