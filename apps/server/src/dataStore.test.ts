import { describe, expect, it } from 'vitest';
import { openServerDb, seedOwnerUser } from './db';
import { SqliteDataStore } from './dataStore';

const emptyData = () => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: []
});

const streakRow = (id: string, name: string, archived_at: string | null = null, extra: Partial<{ extra_calories: number; extra_protein: number; extra_water_ml: number }> = {}) => ({
  id, name, description: null, frequency: 'daily', weekly_target: null,
  scheduled_days_json: null, can_fail: 0, archived_at, sort_order: 0,
  extra_calories: null, extra_protein: null, extra_water_ml: null,
  ...extra
});

describe('SqliteDataStore.putData', () => {
  it('removes streak activities missing from the snapshot', () => {
    const db = openServerDb(':memory:');
    seedOwnerUser(db, 'owner');
    const store = new SqliteDataStore(db);
    const keepKv = [{ key: 'k', value: 'v', updated_at: 1 }];
    store.putData('owner', { ...emptyData(), streakActivities: [streakRow('a1', 'Run')], appKv: keepKv });
    expect(store.getData('owner').streakActivities).toHaveLength(1);
    store.putData('owner', { ...emptyData(), streakActivities: [], appKv: keepKv });
    expect(store.getData('owner').streakActivities).toHaveLength(0);
    db.close();
  });

  it('refuses a fully empty snapshot when data already exists', () => {
    const db = openServerDb(':memory:');
    seedOwnerUser(db, 'owner');
    const store = new SqliteDataStore(db);
    store.putData('owner', { ...emptyData(), appKv: [{ key: 'k', value: 'v', updated_at: 1 }] });
    expect(() => store.putData('owner', emptyData())).toThrow();
    expect(store.getData('owner').appKv).toHaveLength(1);
    db.close();
  });

  it('updates archived_at when an activity is archived', () => {
    const db = openServerDb(':memory:');
    seedOwnerUser(db, 'owner');
    const store = new SqliteDataStore(db);
    store.putData('owner', { ...emptyData(), streakActivities: [streakRow('a1', 'Run')] });
    store.putData('owner', { ...emptyData(), streakActivities: [streakRow('a1', 'Run', '2026-06-28')] });
    expect(store.getData('owner').streakActivities[0]?.archived_at).toBe('2026-06-28');
    db.close();
  });

  it('round-trips water and streak cross-log fields', () => {
    const db = openServerDb(':memory:');
    seedOwnerUser(db, 'owner');
    const store = new SqliteDataStore(db);
    store.putData('owner', {
      ...emptyData(),
      waterConfig: { target_ml: 2800, log_day: '2026-06-28' },
      waterEntries: [{ id: 'w1', log_day: '2026-06-28', label: 'Bottle', ml: 500, count: 1, updated_at: '2026-06-28T10:00:00Z', deleted: 0 }],
      streakActivities: [streakRow('a1', 'Vitamins', null, { extra_calories: 50, extra_water_ml: 250 })]
    });
    const data = store.getData('owner');
    expect(data.waterConfig?.target_ml).toBe(2800);
    expect(data.waterEntries).toHaveLength(1);
    expect(data.streakActivities[0]?.extra_calories).toBe(50);
    expect(data.streakActivities[0]?.extra_water_ml).toBe(250);
    db.close();
  });

  it('applies row patch without wiping untouched tables', () => {
    const db = openServerDb(':memory:');
    seedOwnerUser(db, 'owner');
    const store = new SqliteDataStore(db);
    store.putData('owner', {
      ...emptyData(),
      appKv: [{ key: 'keep', value: '1', updated_at: 1 }],
      waterEntries: [{ id: 'w1', log_day: '2026-06-28', label: 'Bottle', ml: 500, count: 1, updated_at: '2026-06-28T10:00:00Z', deleted: 0 }]
    });
    store.putDataPatch('owner', {
      appKv: {
        upserts: [{ key: 'keep', value: '2', updated_at: 2 }]
      }
    });
    const data = store.getData('owner');
    expect(data.appKv[0]?.value).toBe('2');
    expect(data.waterEntries).toHaveLength(1);
    db.close();
  });
});
