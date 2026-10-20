import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { applySyncChanges, extractUserData, getSyncCursor, setSyncCursor } from '@mgmt/sync';
import { runSchemaMigrations, type SqlDatabase } from '@mgmt/storage';
import { openServerDb, seedOwnerUser } from './db';
import { SqliteDataStore } from './dataStore';

/**
 * Two fake devices + the real server store. Each device is a real SQLite DB
 * with the production local schema; "the network" is calling the store and
 * feeding its numbered changes to the other device, exactly like the client.
 */

const wrapSqlite = (db: Database.Database): SqlDatabase => ({
  select: async <T>(query: string, bind?: unknown[]) => {
    const sql = query.replace(/\$(\d+)/g, '?');
    return (bind?.length ? db.prepare(sql).all(...bind) : db.prepare(sql).all()) as T;
  },
  execute: async (query: string, bind?: unknown[]) => {
    const sql = query.replace(/\$(\d+)/g, '?');
    if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(sql)) {
      db.exec(sql);
      return { lastInsertId: 0, rowsAffected: 0 };
    }
    const info = bind?.length ? db.prepare(sql).run(...bind) : db.prepare(sql).run();
    return { lastInsertId: Number(info.lastInsertRowid), rowsAffected: info.changes };
  }
});

const makeDevice = async (): Promise<SqlDatabase> => {
  const device = wrapSqlite(new Database(':memory:'));
  await runSchemaMigrations(device);
  return device;
};

/** Device pulls every server change after its cursor and applies them verbatim. */
const pull = async (store: SqliteDataStore, device: SqlDatabase): Promise<void> => {
  const cursor = await getSyncCursor(device);
  const resp = store.getChanges('owner', cursor);
  if (resp.changes.length) await applySyncChanges(device, resp.changes, resp.currentSeq);
  else await setSyncCursor(device, resp.currentSeq);
};

const cell = (state: string, updated_at: string) => ({
  log_date: '2026-07-26', activity_id: 'run', state, updated_at
});

describe('two-device convergence through the server referee', () => {
  it('a check-off on device A appears on device B, and an un-check on B disappears on A', async () => {
    const serverDb = openServerDb(':memory:');
    seedOwnerUser(serverDb, 'owner');
    const store = new SqliteDataStore(serverDb);
    const deviceA = await makeDevice();
    const deviceB = await makeDevice();

    // Both devices bootstrap (empty server): cursor = snapshot seq (snapshot marker).
    store.putData('owner', {
      focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
      nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
      streakActivities: [], streakLogCells: [], streakActivityMeta: [],
      waterConfig: null, waterEntries: [], syncTombstones: []
    });
    await pull(store, deviceA);
    await pull(store, deviceB);

    // A checks off a habit: A's patch reaches the server, B pulls the numbered change.
    store.putDataPatch('owner', { streakLogCells: { upserts: [cell('success', '2026-07-26T10:00:00.000Z')] } });
    await pull(store, deviceB);
    expect((await extractUserData(deviceB)).streakLogCells).toEqual([cell('success', '2026-07-26T10:00:00.000Z')]);

    // B un-checks it (hard delete + tombstone, as the client sends): A pulls and the row is gone.
    store.putDataPatch('owner', {
      streakLogCells: { deletes: [{ log_date: '2026-07-26', activity_id: 'run' }] },
      syncTombstones: { upserts: [{ entity: 'streakLogCells', row_key: '2026-07-26\u001frun', deleted_at: '2026-07-26T11:00:00.000Z' }] }
    });
    await pull(store, deviceA);
    expect((await extractUserData(deviceA)).streakLogCells).toEqual([]);
    expect(await getSyncCursor(deviceA)).toBe(store.getCurrentSeq('owner'));
    serverDb.close();
  });

  it('a stale edit loses on the server and the loser is corrected on its next pull', async () => {
    const serverDb = openServerDb(':memory:');
    seedOwnerUser(serverDb, 'owner');
    const store = new SqliteDataStore(serverDb);
    const deviceA = await makeDevice();

    store.putDataPatch('owner', { appKv: { upserts: [{ key: 'prefs', value: 'new', updated_at: 200 }] } });
    await pull(store, deviceA);
    expect((await extractUserData(deviceA)).appKv).toEqual([{ key: 'prefs', value: 'new', updated_at: 200 }]);

    // A's older copy arrives late: server refuses it and logs its final row; A converges back.
    store.putDataPatch('owner', { appKv: { upserts: [{ key: 'prefs', value: 'old', updated_at: 100 }] } });
    await pull(store, deviceA);
    expect((await extractUserData(deviceA)).appKv).toEqual([{ key: 'prefs', value: 'new', updated_at: 200 }]);
    serverDb.close();
  });
});
