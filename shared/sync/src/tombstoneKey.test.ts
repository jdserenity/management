import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import {
  emptyUserData,
  hydrateDb,
  normalizeSyncTombstones,
  tombstoneRowKey,
  TOMBSTONE_KEY_SEP,
  type UserData
} from './userData';
import { runSchemaMigrations, type SqlDatabase } from '@mgmt/storage';

const wrapSqlJs = (db: InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>): SqlDatabase => ({
  select: async <T>(query: string, bind?: unknown[]) => {
    const sql = query.replace(/\$(\d+)/g, '?');
    const stmt = db.prepare(sql);
    try {
      if (bind?.length) stmt.bind(bind as never);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows as T;
    } finally {
      stmt.free();
    }
  },
  execute: async (query: string, bind?: unknown[]) => {
    db.run(query.replace(/\$(\d+)/g, '?'), bind as never);
    return { lastInsertId: 0, rowsAffected: db.getRowsModified() };
  }
});

describe('tombstone row keys', () => {
  it('joins composite parts with unit separator, not NUL', () => {
    expect(tombstoneRowKey('2026-07-17', 'jog')).toBe(`2026-07-17${TOMBSTONE_KEY_SEP}jog`);
    expect(tombstoneRowKey('2026-07-17', 'jog').includes('\0')).toBe(false);
  });

  it('normalizes legacy NUL separators and dedupes by newer deleted_at', () => {
    const rows = normalizeSyncTombstones([
      { entity: 'streakLogCells', row_key: '2026-07-17\0jog', deleted_at: '2026-07-17T10:00:00.000Z' },
      { entity: 'streakLogCells', row_key: `2026-07-17${TOMBSTONE_KEY_SEP}jog`, deleted_at: '2026-07-17T12:00:00.000Z' },
      { entity: 'streakLogCells', row_key: '2026-07-17\0water', deleted_at: '2026-07-17T11:00:00.000Z' }
    ]);
    expect(rows).toEqual([
      { entity: 'streakLogCells', row_key: `2026-07-17${TOMBSTONE_KEY_SEP}jog`, deleted_at: '2026-07-17T12:00:00.000Z' },
      { entity: 'streakLogCells', row_key: `2026-07-17${TOMBSTONE_KEY_SEP}water`, deleted_at: '2026-07-17T11:00:00.000Z' }
    ]);
  });

  it('hydrateDb can store two same-day streakLogCells tombstones in sql.js', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const db = wrapSqlJs(raw);
    await runSchemaMigrations(db);
    const data: UserData = {
      ...emptyUserData(),
      syncTombstones: [
        { entity: 'streakLogCells', row_key: tombstoneRowKey('2026-07-17', 'jog'), deleted_at: '2026-07-17T10:00:00.000Z' },
        { entity: 'streakLogCells', row_key: tombstoneRowKey('2026-07-17', 'water'), deleted_at: '2026-07-17T11:00:00.000Z' }
      ]
    };
    await expect(hydrateDb(db, data)).resolves.toBeUndefined();
    const rows = await db.select<{ entity: string; row_key: string }[]>(
      'SELECT entity, row_key FROM sync_tombstones ORDER BY row_key'
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.row_key)).toEqual([
      tombstoneRowKey('2026-07-17', 'jog'),
      tombstoneRowKey('2026-07-17', 'water')
    ]);
  });

  it('hydrateDb still fails if legacy NUL keys are written without normalization', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    raw.run(
      'CREATE TABLE sync_tombstones (entity TEXT NOT NULL, row_key TEXT NOT NULL, deleted_at TEXT NOT NULL, PRIMARY KEY (entity, row_key))'
    );
    expect(() => {
      raw.run('INSERT INTO sync_tombstones VALUES (?,?,?)', [
        'streakLogCells',
        '2026-07-17\0jog',
        't1'
      ]);
      raw.run('INSERT INTO sync_tombstones VALUES (?,?,?)', [
        'streakLogCells',
        '2026-07-17\0water',
        't2'
      ]);
    }).toThrow(/UNIQUE constraint failed/);
  });
});
