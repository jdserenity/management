import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SqlDatabase } from '@mgmt/storage';
import {
  clearSyncOutboxIds,
  drainSyncOutbox,
  enqueueSyncPatch,
  mergeUserDataRowPatches,
  readSyncOutbox
} from './syncOutbox';
import { setSyncFetchImpl } from './syncFetch';

type OutboxRow = { id: number; patch_json: string; created_at: number };

const makeOutboxDb = (): SqlDatabase & { rows: OutboxRow[] } => {
  const rows: OutboxRow[] = [];
  let nextId = 1;
  return {
    rows,
    select: async <T>(q: string): Promise<T> => {
      if (q.includes('FROM sync_outbox')) return [...rows] as T;
      return [] as T;
    },
    execute: async (q: string, bind?: unknown[]) => {
      if (q.includes('INSERT INTO sync_outbox')) {
        rows.push({ id: nextId++, patch_json: String(bind?.[0] ?? '{}'), created_at: Number(bind?.[1] ?? Date.now()) });
        return { lastInsertId: nextId, rowsAffected: 1 };
      }
      if (q.includes('DELETE FROM sync_outbox')) {
        const count = rows.length;
        rows.length = 0;
        return { lastInsertId: 0, rowsAffected: count };
      }
      return { lastInsertId: 0, rowsAffected: 0 };
    }
  };
};

describe('syncOutbox', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setSyncFetchImpl(fetch);
  });

  it('enqueueSyncPatch stores row patches', async () => {
    const db = makeOutboxDb();
    await enqueueSyncPatch(db, { appKv: { upserts: [{ key: 'k', value: 'v', updated_at: 1 }] } });
    const rows = await readSyncOutbox(db);
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].patch_json)).toEqual({ appKv: { upserts: [{ key: 'k', value: 'v', updated_at: 1 }] } });
  });

  it('mergeUserDataRowPatches keeps later upsert for same key', () => {
    const merged = mergeUserDataRowPatches(
      { appKv: { upserts: [{ key: 'k', value: 'old', updated_at: 1 }] } },
      { appKv: { upserts: [{ key: 'k', value: 'new', updated_at: 2 }] } }
    );
    expect(merged.appKv?.upserts?.[0]?.value).toBe('new');
  });

  it('drainSyncOutbox pushes merged patch and clears queue', async () => {
    const db = makeOutboxDb();
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    setSyncFetchImpl(mockFetch);
    await enqueueSyncPatch(db, { appKv: { upserts: [{ key: 'a', value: '1', updated_at: 1 }] } });
    await enqueueSyncPatch(db, { appKv: { upserts: [{ key: 'b', value: '2', updated_at: 2 }] } });
    const result = await drainSyncOutbox(db, 'http://localhost:8787', 'tok');
    expect(result.ok).toBe(true);
    expect(result.drained).toBe(2);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8787/v1/data/patch',
      expect.objectContaining({ method: 'POST' })
    );
    expect(await readSyncOutbox(db)).toHaveLength(0);
  });

  it('keeps outbox rows when drain fails for offline retry', async () => {
    const db = makeOutboxDb();
    const mockFetch = vi.fn().mockRejectedValue(new Error('offline'));
    setSyncFetchImpl(mockFetch);
    await enqueueSyncPatch(db, { appKv: { upserts: [{ key: 'k', value: 'v', updated_at: 1 }] } });
    const result = await drainSyncOutbox(db, 'http://localhost:8787', 'tok');
    expect(result.ok).toBe(false);
    expect(await readSyncOutbox(db)).toHaveLength(1);
  });

  it('clearSyncOutboxIds removes processed rows', async () => {
    const db = makeOutboxDb();
    await enqueueSyncPatch(db, { appKv: { upserts: [{ key: 'k', value: 'v', updated_at: 1 }] } });
    const rows = await readSyncOutbox(db);
    await clearSyncOutboxIds(db, rows.map((r) => r.id));
    expect(await readSyncOutbox(db)).toHaveLength(0);
  });
});
