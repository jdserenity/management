import { describe, expect, it } from 'vitest';
import { openServerDb, seedOwnerUser } from './db';
import { SqliteDataStore } from './dataStore';

const emptyData = () => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: []
});

const streakRow = (id: string, name: string, archived_at: string | null = null) => ({
  id, name, description: null, frequency: 'daily', weekly_target: null,
  scheduled_days_json: null, can_fail: 0, archived_at, sort_order: 0
});

describe('SqliteDataStore.putData', () => {
  it('removes streak activities missing from the snapshot', () => {
    const db = openServerDb(':memory:');
    seedOwnerUser(db, 'owner');
    const store = new SqliteDataStore(db);
    store.putData('owner', { ...emptyData(), streakActivities: [streakRow('a1', 'Run')] });
    expect(store.getData('owner').streakActivities).toHaveLength(1);
    store.putData('owner', { ...emptyData(), streakActivities: [] });
    expect(store.getData('owner').streakActivities).toHaveLength(0);
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
});
