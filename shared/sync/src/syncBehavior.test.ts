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
