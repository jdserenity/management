import { describe, expect, it } from 'vitest';
import { mergeUserData } from './mergeUserData';
import { mergeUserDataRowPatches } from './syncOutbox';
import { buildUserDataRowPatch, emptyUserData, hasUserDataRowPatchChanges, USER_DATA_TABLES } from './userData';

const streakActivity = (overrides: Record<string, unknown> = {}) => ({
  id: 'habit-1', name: 'Vitamins', description: null, frequency: 'daily', weekly_target: null,
  scheduled_days_json: null, can_fail: 0, necessary: 0, archived_at: null, sort_order: 0,
  linked_staple_id: null, linked_water: 0, linked_movement_burst: 0,
  extra_calories: null, extra_protein: null, extra_water_ml: null,
  updated_at: '2026-07-01T00:00:00.000Z',
  ...overrides
});

describe('sync behavior matrix', () => {
  it('archive: server archive wins over local check-offs on pull merge', () => {
    const local = {
      ...emptyUserData(),
      streakActivities: [streakActivity({ archived_at: null, updated_at: '2026-06-01T00:00:00.000Z' })],
      streakLogCells: [{ log_date: '2026-07-07', activity_id: 'habit-1', state: 'success', updated_at: '2026-07-07T20:00:00.000Z' }]
    };
    const server = {
      ...emptyUserData(),
      streakActivities: [streakActivity({ archived_at: '2026-07-07', updated_at: '2026-07-07T12:00:00.000Z' })]
    };
    expect(mergeUserData(local, server).streakActivities[0]?.archived_at).toBe('2026-07-07');
  });

  it('archive: sticky when other device reorders after archive (newer active-only row)', () => {
    const local = {
      ...emptyUserData(),
      streakActivities: [streakActivity({ archived_at: null, updated_at: '2026-07-08T18:00:00.000Z', sort_order: 2 })]
    };
    const server = {
      ...emptyUserData(),
      streakActivities: [streakActivity({ archived_at: '2026-07-07', updated_at: '2026-07-07T12:00:00.000Z', sort_order: 0 })]
    };
    expect(mergeUserData(local, server).streakActivities[0]?.archived_at).toBe('2026-07-07');
  });

  it('hard delete: tombstone prevents local ghost from reappearing after pull merge', () => {
    const local = {
      ...emptyUserData(),
      streakActivities: [streakActivity({ id: 'old-habit', updated_at: '2026-07-01T00:00:00.000Z' })]
    };
    const server = {
      ...emptyUserData(),
      streakActivities: [],
      syncTombstones: [{ entity: 'streakActivities', row_key: 'old-habit', deleted_at: '2026-07-08T00:00:00.000Z' }]
    };
    expect(mergeUserData(local, server).streakActivities).toEqual([]);
  });

  it('outbox: newer archive upsert beats older active upsert for same habit', () => {
    const merged = mergeUserDataRowPatches(
      {
        streakActivities: {
          upserts: [streakActivity({ archived_at: null, updated_at: '2026-07-01T00:00:00.000Z' }) as never]
        }
      },
      {
        streakActivities: {
          upserts: [streakActivity({ archived_at: '2026-07-07', updated_at: '2026-07-07T12:00:00.000Z' }) as never]
        }
      }
    );
    expect(merged.streakActivities?.upserts?.[0]?.archived_at).toBe('2026-07-07');
  });

  it('delete patch attaches a tombstone so other devices can drop the row', () => {
    const before = { ...emptyUserData(), streakActivities: [streakActivity({ id: 'x' })] };
    const after = { ...emptyUserData(), streakActivities: [] };
    const patch = buildUserDataRowPatch(before, after, USER_DATA_TABLES);
    expect(patch.streakActivities?.deletes).toEqual([{ id: 'x' }]);
    expect(patch.syncTombstones?.upserts?.some((t) => t.entity === 'streakActivities' && t.row_key === 'x')).toBe(true);
  });

  it('staple edit: row patch carries only changed staple', () => {
    const before = {
      ...emptyUserData(),
      nutritionStaples: [{ id: 's1', name: 'Eggs', calories: 140, protein: 12, ingredients_json: null, sort_order: 0, updated_at: '2026-06-01T00:00:00.000Z' }]
    };
    const after = {
      ...before,
      nutritionStaples: [{ id: 's1', name: 'Free-range eggs', calories: 140, protein: 12, ingredients_json: null, sort_order: 0, updated_at: '2026-07-07T12:00:00.000Z' }]
    };
    const patch = buildUserDataRowPatch(before, after, ['nutritionStaples']);
    expect(patch.nutritionStaples?.upserts?.[0]?.name).toBe('Free-range eggs');
    expect(patch.nutritionStaples?.deletes).toEqual([]);
  });

  it('check-off: streak log cell patch is per day+activity', () => {
    const before = { ...emptyUserData(), streakLogCells: [] };
    const after = {
      ...emptyUserData(),
      streakLogCells: [{ log_date: '2026-07-07', activity_id: 'habit-1', state: 'success', updated_at: '2026-07-07T08:00:00.000Z' }]
    };
    const patch = buildUserDataRowPatch(before, after, ['streakLogCells']);
    expect(patch.streakLogCells?.upserts).toHaveLength(1);
    expect(hasUserDataRowPatchChanges(patch)).toBe(true);
  });

  it('offline retry: outbox merges queued patches before push', () => {
    const merged = mergeUserDataRowPatches(
      { appKv: { upserts: [{ key: 'prefs', value: 'a', updated_at: 1 }] } },
      { appKv: { upserts: [{ key: 'prefs', value: 'b', updated_at: 2 }] } }
    );
    expect(merged.appKv?.upserts?.[0]?.value).toBe('b');
  });

  it('bootstrap upload: diff from empty sends upserts not full-table deletes', () => {
    const local = {
      ...emptyUserData(),
      waterConfig: { target_ml: 2800, log_day: '2026-07-07', updated_at: '2026-07-07T12:00:00.000Z' }
    };
    const patch = buildUserDataRowPatch(emptyUserData(), local, USER_DATA_TABLES);
    expect(patch.waterConfig?.set?.target_ml).toBe(2800);
    expect(patch.focusLog?.deletes).toBeUndefined();
  });
});
