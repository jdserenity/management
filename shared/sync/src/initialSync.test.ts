import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./userData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./userData')>();
  return {
    ...actual,
    extractUserData: vi.fn(),
    fetchUserDataWithSeq: vi.fn(),
    hydrateDb: vi.fn(),
    pushUserDataDiff: vi.fn()
  };
});

vi.mock('./changeSync', () => ({
  getSyncCursor: vi.fn(),
  setSyncCursor: vi.fn(),
  fetchSyncChanges: vi.fn(),
  applySyncChanges: vi.fn()
}));
vi.mock('./syncOutbox', () => ({ drainSyncOutbox: vi.fn().mockResolvedValue({ ok: true, drained: 0 }) }));
vi.mock('./dataSyncEvents', () => ({ dispatchDataSyncRefresh: vi.fn() }));

import { applySyncChanges, fetchSyncChanges, getSyncCursor, setSyncCursor } from './changeSync';
import { extractUserData, fetchUserDataWithSeq, hydrateDb, pushUserDataDiff } from './userData';
import { pullAndMergeUserData, resetSyncWarningForTests, runBidirectionalInitialSync } from './initialSync';

const empty = () => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: [], syncTombstones: []
});

const db = { select: vi.fn(), execute: vi.fn() };
const opts = { logLabel: 'test', db, serverUrl: 'https://mgmt.levier.cc', serverToken: 'tok' };

beforeEach(() => {
  vi.clearAllMocks();
  resetSyncWarningForTests();
  vi.mocked(extractUserData).mockResolvedValue(empty());
  vi.mocked(fetchUserDataWithSeq).mockResolvedValue({ data: empty(), seq: 0 });
  vi.mocked(hydrateDb).mockResolvedValue(undefined);
  vi.mocked(pushUserDataDiff).mockResolvedValue(undefined);
  vi.mocked(getSyncCursor).mockResolvedValue(0);
  vi.mocked(setSyncCursor).mockResolvedValue(undefined);
  vi.mocked(fetchSyncChanges).mockResolvedValue({ changes: [], currentSeq: 0, snapshotRequired: false });
  vi.mocked(applySyncChanges).mockResolvedValue(0);
});

describe('runBidirectionalInitialSync (change-log referee)', () => {
  it('skips when creds missing', async () => {
    const result = await runBidirectionalInitialSync({ logLabel: 'test', db, serverUrl: undefined, serverToken: undefined });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no-creds');
  });

  it('bootstraps an empty device from the snapshot and saves the cursor', async () => {
    const server = { ...empty(), streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'success', updated_at: '2026-06-28T12:00:00.000Z' }] };
    vi.mocked(fetchUserDataWithSeq).mockResolvedValue({ data: server, seq: 4 });
    const result = await runBidirectionalInitialSync(opts);
    expect(result.pullOk).toBe(true);
    expect(hydrateDb).toHaveBeenCalledWith(db, server);
    expect(setSyncCursor).toHaveBeenCalledWith(db, 4);
    expect(pushUserDataDiff).not.toHaveBeenCalled();
    expect(fetchSyncChanges).not.toHaveBeenCalled();
  });

  it('converges a device with local data through the server: upload, then adopt final snapshot', async () => {
    const local = { ...empty(), appKv: [{ key: 'k', value: 'v', updated_at: 1 }] };
    // Server kept a different final value (its guard won) — the device must adopt it verbatim.
    const serverFinal = { ...empty(), appKv: [{ key: 'k', value: 'server-final', updated_at: 5 }] };
    vi.mocked(extractUserData).mockResolvedValue(local);
    vi.mocked(fetchUserDataWithSeq)
      .mockResolvedValueOnce({ data: empty(), seq: 0 })
      .mockResolvedValueOnce({ data: serverFinal, seq: 1 });
    const result = await runBidirectionalInitialSync(opts);
    expect(result.pullOk).toBe(true);
    expect(pushUserDataDiff).toHaveBeenCalledWith('https://mgmt.levier.cc', 'tok', empty(), local);
    expect(hydrateDb).toHaveBeenCalledWith(db, serverFinal);
    expect(setSyncCursor).toHaveBeenCalledWith(db, 1);
  });

  it('reports pull-failed (and does not hydrate) when the server is unreachable', async () => {
    vi.mocked(getSyncCursor).mockResolvedValue(9);
    vi.mocked(fetchSyncChanges).mockRejectedValue(new Error('fetchSyncChanges: network down'));
    const result = await runBidirectionalInitialSync(opts);
    expect(result.pullOk).toBe(false);
    expect(result.reason).toBe('pull-failed');
    expect(hydrateDb).not.toHaveBeenCalled();
  });
});

describe('pullAndMergeUserData (change-log referee)', () => {
  it('returns false without creds', async () => {
    expect(await pullAndMergeUserData({ logLabel: 'test', db })).toBe(false);
  });

  it('applies numbered changes after the cursor — no snapshot fetch, no merge, no hydrate', async () => {
    vi.mocked(getSyncCursor).mockResolvedValue(3);
    const change = {
      seq: 4, entity: 'streakLogCells' as const, rowKey: '2026-07-26\u001frun', op: 'upsert' as const,
      row: { log_date: '2026-07-26', activity_id: 'run', state: 'success', updated_at: '2026-07-26T10:00:00.000Z' }
    };
    vi.mocked(fetchSyncChanges).mockResolvedValue({ changes: [change], currentSeq: 4, snapshotRequired: false });
    const ok = await pullAndMergeUserData(opts);
    expect(ok).toBe(true);
    expect(fetchSyncChanges).toHaveBeenCalledWith('https://mgmt.levier.cc', 'tok', 3);
    expect(applySyncChanges).toHaveBeenCalledWith(db, [change], 4);
    expect(fetchUserDataWithSeq).not.toHaveBeenCalled();
    expect(hydrateDb).not.toHaveBeenCalled();
  });

  it('does nothing when already at the server seq', async () => {
    vi.mocked(getSyncCursor).mockResolvedValue(4);
    vi.mocked(fetchSyncChanges).mockResolvedValue({ changes: [], currentSeq: 4, snapshotRequired: false });
    expect(await pullAndMergeUserData(opts)).toBe(true);
    expect(applySyncChanges).not.toHaveBeenCalled();
    expect(setSyncCursor).not.toHaveBeenCalled();
  });

  it('re-bootstraps when the server restarted its log (snapshot marker)', async () => {
    vi.mocked(getSyncCursor).mockResolvedValue(3);
    vi.mocked(fetchSyncChanges).mockResolvedValue({
      changes: [{ seq: 1, entity: '__snapshot__', rowKey: '', op: 'snapshot', row: null }],
      currentSeq: 1,
      snapshotRequired: false
    });
    vi.mocked(fetchUserDataWithSeq).mockResolvedValue({ data: empty(), seq: 1 });
    expect(await pullAndMergeUserData(opts)).toBe(true);
    expect(fetchUserDataWithSeq).toHaveBeenCalled();
    expect(setSyncCursor).toHaveBeenCalledWith(db, 1);
    expect(applySyncChanges).not.toHaveBeenCalled();
  });

  it('re-bootstraps when the cursor is ahead of a reset server', async () => {
    vi.mocked(getSyncCursor).mockResolvedValue(50);
    vi.mocked(fetchSyncChanges).mockResolvedValue({ changes: [], currentSeq: 2, snapshotRequired: false });
    vi.mocked(fetchUserDataWithSeq).mockResolvedValue({ data: empty(), seq: 2 });
    expect(await pullAndMergeUserData(opts)).toBe(true);
    expect(fetchUserDataWithSeq).toHaveBeenCalled();
  });

  it('returns false when the change fetch fails', async () => {
    vi.mocked(getSyncCursor).mockResolvedValue(3);
    vi.mocked(fetchSyncChanges).mockRejectedValue(new Error('fetchSyncChanges: HTTP 500'));
    expect(await pullAndMergeUserData(opts)).toBe(false);
    expect(hydrateDb).not.toHaveBeenCalled();
  });
});
