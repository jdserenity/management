import { describe, expect, it } from 'vitest';
import { openServerDb, seedOwnerUser } from './db';
import { SqliteDataStore } from './dataStore';

const emptyData = () => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: [], syncTombstones: []
});

const open = () => {
  const db = openServerDb(':memory:');
  seedOwnerUser(db, 'owner');
  return { db, store: new SqliteDataStore(db) };
};

describe('SqliteDataStore change log (server referee)', () => {
  it('numbers accepted patch rows in order and serves only changes after the cursor', () => {
    const { db, store } = open();
    store.putDataPatch('owner', { appKv: { upserts: [{ key: 'a', value: '1', updated_at: 1 }] } });
    store.putDataPatch('owner', {
      appKv: { upserts: [{ key: 'a', value: '2', updated_at: 2 }] },
      streakLogCells: { upserts: [{ log_date: '2026-07-26', activity_id: 'run', state: 'success', updated_at: '2026-07-26T10:00:00.000Z' }] }
    });
    const all = store.getChanges('owner', 0);
    expect(all.currentSeq).toBe(3);
    expect(all.snapshotRequired).toBe(false);
    expect(all.changes.map((c) => [c.seq, c.entity, c.op])).toEqual([
      [1, 'appKv', 'upsert'],
      [2, 'appKv', 'upsert'],
      [3, 'streakLogCells', 'upsert']
    ]);
    expect(all.changes[1]?.row).toMatchObject({ key: 'a', value: '2' });
    const afterFirst = store.getChanges('owner', 1);
    expect(afterFirst.changes.map((c) => c.seq)).toEqual([2, 3]);
    db.close();
  });

  it('records the final server row when a stale patch loses, so the loser gets corrected', () => {
    const { db, store } = open();
    store.putData('owner', { ...emptyData(), appKv: [{ key: 'k', value: 'new', updated_at: 200 }] });
    store.putDataPatch('owner', { appKv: { upserts: [{ key: 'k', value: 'old', updated_at: 100 }] } });
    const { changes } = store.getChanges('owner', 1);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ entity: 'appKv', op: 'upsert' });
    expect(changes[0]?.row).toMatchObject({ key: 'k', value: 'new' });
    db.close();
  });

  it('records sticky-archive final state, not the active-only row that was sent', () => {
    const { db, store } = open();
    const base = {
      id: 'a1', name: 'Run', description: null, frequency: 'daily', weekly_target: null,
      scheduled_days_json: null, can_fail: 0, necessary: 0, sort_order: 0,
      linked_staple_id: null, linked_water: 0, linked_movement_burst: 0,
      extra_calories: null, extra_protein: null, extra_water_ml: null,
      automatic_kind: null, enabled: 1
    };
    store.putData('owner', { ...emptyData(), streakActivities: [{ ...base, archived_at: '2026-07-07', updated_at: '2026-07-07T12:00:00Z' }] });
    store.putDataPatch('owner', {
      streakActivities: { upserts: [{ ...base, name: 'Renamed', archived_at: null, updated_at: '2026-07-08T18:00:00Z' }] }
    });
    const { changes } = store.getChanges('owner', 1);
    const change = changes.find((c) => c.entity === 'streakActivities');
    expect(change?.row).toMatchObject({ name: 'Renamed', archived_at: '2026-07-07' });
    db.close();
  });

  it('records deletes (with their key) so other devices drop the row without merging', () => {
    const { db, store } = open();
    store.putDataPatch('owner', {
      streakLogCells: { upserts: [{ log_date: '2026-07-26', activity_id: 'run', state: 'success', updated_at: '2026-07-26T10:00:00.000Z' }] }
    });
    store.putDataPatch('owner', {
      streakLogCells: { deletes: [{ log_date: '2026-07-26', activity_id: 'run' }] },
      syncTombstones: { upserts: [{ entity: 'streakLogCells', row_key: '2026-07-26\u001frun', deleted_at: '2026-07-26T11:00:00.000Z' }] }
    });
    const { changes } = store.getChanges('owner', 1);
    const del = changes.find((c) => c.entity === 'streakLogCells');
    expect(del).toMatchObject({ op: 'delete', row: null });
    expect(del?.key).toEqual({ log_date: '2026-07-26', activity_id: 'run' });
    expect(store.getData('owner').streakLogCells).toHaveLength(0);
    db.close();
  });

  it('records no new change when a patch re-uploads rows identical to what the server already has', () => {
    const { db, store } = open();
    const cells = [
      { log_date: '2026-07-25', activity_id: 'run', state: 'success', updated_at: '2026-07-25T10:00:00.000Z' },
      { log_date: '2026-07-26', activity_id: 'run', state: 'success', updated_at: '2026-07-26T10:00:00.000Z' }
    ];
    store.putDataPatch('owner', { streakLogCells: { upserts: cells } });
    expect(store.getChanges('owner', 0).currentSeq).toBe(2);
    // Same bulk upload again (e.g. a device replaying its whole history):
    // nothing changed, so no new change-log entries may be minted —
    // every other device would otherwise have to re-apply 1,000s of no-ops.
    store.putDataPatch('owner', { streakLogCells: { upserts: cells } });
    expect(store.getChanges('owner', 0).currentSeq).toBe(2);
    // A patch that actually changes one row still records exactly that one.
    store.putDataPatch('owner', {
      streakLogCells: { upserts: [{ ...cells[0]!, state: 'fail', updated_at: '2026-07-27T10:00:00.000Z' }, cells[1]!] }
    });
    const { changes, currentSeq } = store.getChanges('owner', 0);
    expect(currentSeq).toBe(3);
    expect(changes).toHaveLength(3);
    expect(changes[2]?.row).toMatchObject({ log_date: '2026-07-25', state: 'fail' });
    db.close();
  });

  it('restarts the log with a snapshot marker on full replace', () => {
    const { db, store } = open();
    store.putDataPatch('owner', { appKv: { upserts: [{ key: 'a', value: '1', updated_at: 1 }] } });
    store.putData('owner', { ...emptyData(), appKv: [{ key: 'b', value: '2', updated_at: 2 }] });
    const { changes, currentSeq } = store.getChanges('owner', 0);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ entity: '__snapshot__', op: 'snapshot' });
    expect(currentSeq).toBe(changes[0]?.seq);
    db.close();
  });
});
