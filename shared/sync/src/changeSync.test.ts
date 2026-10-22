import { describe, expect, it, vi } from 'vitest';
import type { SqlDatabase } from '@mgmt/storage';
import { applySyncChanges, fetchSyncChanges, getSyncCursor, setSyncCursor } from './changeSync';
import type { SyncChange } from './syncChanges';

type Call = { q: string; bind?: unknown[] };

const makeDb = (cursorValue?: string) => {
  const calls: Call[] = [];
  const db = {
    calls,
    select: vi.fn(async <T>(q: string): Promise<T> => {
      if (q.includes('FROM sync_state')) {
        return (cursorValue == null ? [] : [{ value: cursorValue }]) as T;
      }
      return [] as T;
    }),
    execute: vi.fn(async (q: string, bind?: unknown[]) => {
      calls.push({ q, bind });
      return { lastInsertId: 1, rowsAffected: 1 };
    })
  } as unknown as SqlDatabase & { calls: Call[] };
  return db;
};

const execs = (db: ReturnType<typeof makeDb>) => db.calls;

describe('sync cursor', () => {
  it('defaults to 0 and round-trips through sync_state', async () => {
    const db = makeDb();
    expect(await getSyncCursor(db)).toBe(0);
    await setSyncCursor(db, 42);
    expect(execs(db).some((c) => c.q.includes('INSERT OR REPLACE INTO sync_state') && c.bind?.[1] === '42')).toBe(true);
    expect(await getSyncCursor(makeDb('42'))).toBe(42);
  });
});

describe('fetchSyncChanges', () => {
  it('requests changes after the cursor with bearer auth', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ changes: [], currentSeq: 7, snapshotRequired: false })
    });
    vi.stubGlobal('fetch', mockFetch);
    const res = await fetchSyncChanges('http://localhost:8787/', 'tok', 3);
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8787/v1/changes?since=3');
    expect(res.currentSeq).toBe(7);
    vi.unstubAllGlobals();
  });

  it('throws on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'no' }));
    await expect(fetchSyncChanges('http://localhost:8787', 'bad', 0)).rejects.toThrow('HTTP 401');
    vi.unstubAllGlobals();
  });
});

describe('applySyncChanges', () => {
  it('upserts rows verbatim with no timestamp comparison', async () => {
    const db = makeDb('0');
    const changes: SyncChange[] = [{
      seq: 1, entity: 'streakLogCells', rowKey: '2026-07-26\u001frun', op: 'upsert',
      row: { log_date: '2026-07-26', activity_id: 'run', state: 'success', updated_at: '2026-07-26T10:00:00.000Z' }
    }];
    const applied = await applySyncChanges(db, changes, 1);
    expect(applied).toBe(1);
    const upsert = execs(db).find((c) => c.q.includes('streak_log_cells'));
    expect(upsert?.q).toContain('INSERT OR REPLACE INTO streak_log_cells');
    expect(upsert?.bind).toEqual(['2026-07-26', 'run', 'success', '2026-07-26T10:00:00.000Z']);
  });

  it('deletes by the key the server sent', async () => {
    const db = makeDb('0');
    const changes: SyncChange[] = [{
      seq: 2, entity: 'streakLogCells', rowKey: '2026-07-26\u001frun', op: 'delete', row: null,
      key: { log_date: '2026-07-26', activity_id: 'run' }
    }];
    await applySyncChanges(db, changes, 2);
    const del = execs(db).find((c) => c.q.startsWith('DELETE FROM streak_log_cells'));
    expect(del?.bind).toEqual(['2026-07-26', 'run']);
  });

  it('upserts singletons with id=1 and deletes them by id', async () => {
    const db = makeDb('0');
    await applySyncChanges(db, [{
      seq: 1, entity: 'nutritionConfig', rowKey: '1', op: 'upsert',
      row: { tdee: 2500, protein: 180, log_day: '2026-07-26', updated_at: '2026-07-26T10:00:00.000Z' }
    }], 1);
    const upsert = execs(db).find((c) => c.q.includes('nutrition_config'));
    expect(upsert?.q).toContain('INSERT OR REPLACE INTO nutrition_config');
    expect(upsert?.bind?.[0]).toBe(2500);

    const db2 = makeDb('1');
    await applySyncChanges(db2, [{ seq: 2, entity: 'nutritionConfig', rowKey: '1', op: 'delete', row: null, key: {} }], 2);
    expect(execs(db2).some((c) => c.q === 'DELETE FROM nutrition_config WHERE id=1')).toBe(true);
  });

  it('advances the cursor to currentSeq inside the same apply', async () => {
    const db = makeDb('0');
    await applySyncChanges(db, [{
      seq: 5, entity: 'appKv', rowKey: 'k', op: 'upsert', row: { key: 'k', value: 'v', updated_at: 9 }
    }], 5);
    const cursorWrite = execs(db).filter((c) => c.q.includes('INSERT OR REPLACE INTO sync_state'));
    expect(cursorWrite.some((c) => c.bind?.[1] === '5')).toBe(true);
    const qs = execs(db).map((c) => c.q);
    expect(qs.indexOf('BEGIN')).toBeLessThan(qs.findIndex((q) => q.includes('app_kv')));
    expect(qs[qs.length - 1]).toBe('COMMIT');
  });

  it('groups consecutive same-table upserts into one statement and saves the cursor per chunk', async () => {
    const db = makeDb('0');
    const cell = (n: number): SyncChange => ({
      seq: n, entity: 'streakLogCells', rowKey: `2026-07-26\u001frun${n}`, op: 'upsert',
      row: { log_date: '2026-07-26', activity_id: `run${n}`, state: 'success', updated_at: '2026-07-26T10:00:00.000Z' }
    });
    const applied = await applySyncChanges(db, [cell(1), cell(2), cell(3)], 3);
    expect(applied).toBe(3);
    const upserts = execs(db).filter((c) => c.q.includes('streak_log_cells'));
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.bind).toHaveLength(12);
    expect(execs(db).filter((c) => c.q === 'BEGIN')).toHaveLength(1);
    expect(execs(db).filter((c) => c.q === 'COMMIT')).toHaveLength(1);
  });

  it('applies large batches in multiple chunks so progress is never all-or-nothing', async () => {
    const db = makeDb('0');
    const changes: SyncChange[] = Array.from({ length: 450 }, (_, i) => ({
      seq: i + 1, entity: 'streakLogCells', rowKey: `2026-07-26\u001frun${i}`, op: 'upsert' as const,
      row: { log_date: '2026-07-26', activity_id: `run${i}`, state: 'success', updated_at: '2026-07-26T10:00:00.000Z' }
    }));
    const applied = await applySyncChanges(db, changes, 450);
    expect(applied).toBe(450);
    // 450 changes / 200 per chunk = 3 transactions, cursor saved after each.
    expect(execs(db).filter((c) => c.q === 'COMMIT')).toHaveLength(3);
    const cursors = execs(db).filter((c) => c.q.includes('INSERT OR REPLACE INTO sync_state')).map((c) => c.bind?.[1]);
    expect(cursors).toEqual(['200', '400', '450']);
  });

  it('isolates a poison change: good changes before it stay applied and the cursor stops before it', async () => {
    const db = makeDb('0');
    (db.execute as ReturnType<typeof vi.fn>).mockImplementation(async (q: string, bind?: unknown[]) => {
      db.calls.push({ q, bind });
      if (q.includes('streak_log_cells') && bind?.includes('poison')) throw new Error('bad row');
      return { lastInsertId: 1, rowsAffected: 1 };
    });
    const cell = (seq: number, id: string): SyncChange => ({
      seq, entity: 'streakLogCells', rowKey: `2026-07-26\u001f${id}`, op: 'upsert',
      row: { log_date: '2026-07-26', activity_id: id, state: 'success', updated_at: '2026-07-26T10:00:00.000Z' }
    });
    await expect(applySyncChanges(db, [cell(1, 'run'), cell(2, 'poison'), cell(3, 'walk')], 3)).rejects.toThrow('bad row');
    const cursors = execs(db).filter((c) => c.q.includes('INSERT OR REPLACE INTO sync_state')).map((c) => c.bind?.[1]);
    expect(cursors[cursors.length - 1]).toBe('1');
  });

  it('rolls back and keeps the old cursor when a change fails', async () => {
    const db = makeDb('3');
    (db.execute as ReturnType<typeof vi.fn>).mockImplementation(async (q: string, bind?: unknown[]) => {
      db.calls.push({ q, bind });
      if (q.includes('streak_log_cells')) throw new Error('disk full');
      return { lastInsertId: 1, rowsAffected: 1 };
    });
    await expect(applySyncChanges(db, [{
      seq: 4, entity: 'streakLogCells', rowKey: 'x', op: 'upsert',
      row: { log_date: '2026-07-26', activity_id: 'run', state: 'success', updated_at: '2026-07-26T10:00:00.000Z' }
    }], 4)).rejects.toThrow('disk full');
    const qs = execs(db).map((c) => c.q);
    expect(qs).toContain('ROLLBACK');
    expect(qs).not.toContain('COMMIT');
  });
});
