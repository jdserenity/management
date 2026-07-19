import { describe, expect, it } from 'vitest';
import { openServerDb, rewriteSyncTombstoneRowKeys, seedOwnerUser } from './db';

describe('rewriteSyncTombstoneRowKeys', () => {
  it('rewrites embedded NUL separators to unit separators', () => {
    const db = openServerDb(':memory:');
    seedOwnerUser(db, 'owner');
    db.prepare(
      'INSERT INTO sync_tombstones (entity, row_key, user_id, deleted_at) VALUES (?, ?, ?, ?)'
    ).run('streakLogCells', '2026-07-17\0jog', 'owner', '2026-07-17T10:00:00.000Z');
    db.prepare(
      'INSERT INTO sync_tombstones (entity, row_key, user_id, deleted_at) VALUES (?, ?, ?, ?)'
    ).run('streakLogCells', '2026-07-17\0water', 'owner', '2026-07-17T11:00:00.000Z');

    expect(rewriteSyncTombstoneRowKeys(db)).toBe(2);
    const rows = db
      .prepare('SELECT row_key FROM sync_tombstones WHERE user_id=? ORDER BY row_key')
      .all('owner') as Array<{ row_key: string }>;
    expect(rows.map((r) => r.row_key)).toEqual(['2026-07-17\u001fjog', '2026-07-17\u001fwater']);
    expect(rewriteSyncTombstoneRowKeys(db)).toBe(0);
  });
});
