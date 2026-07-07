import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runBidirectionalInitialSync, pullAndMergeUserData, pushUserData, extractUserData, startUserDataPolling } = vi.hoisted(() => ({
  runBidirectionalInitialSync: vi.fn(),
  pullAndMergeUserData: vi.fn(),
  pushUserData: vi.fn(),
  extractUserData: vi.fn(),
  startUserDataPolling: vi.fn(() => vi.fn())
}));

vi.mock('@mgmt/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mgmt/sync')>();
  return { ...actual, runBidirectionalInitialSync, pullAndMergeUserData, pushUserData, extractUserData, startUserDataPolling };
});
vi.mock('@/lib/db', () => ({ registerSqlBackend: vi.fn() }));
vi.mock('./sqlJsStorage', () => ({
  createCompanionSqlJsDatabase: vi.fn(async () => ({
    select: vi.fn(async () => []),
    execute: vi.fn(async () => ({ lastInsertId: 0, rowsAffected: 1 }))
  }))
}));

import {
  initCompanionStorage,
  resetCompanionStorageForTests,
  runCompanionInitialSync,
  startCompanionForegroundPull
} from './storage';

describe('companion storage sync', () => {
  beforeEach(() => {
    resetCompanionStorageForTests();
    vi.stubEnv('VITE_SERVER_URL', 'https://mgmt.levier.cc');
    vi.stubEnv('VITE_SERVER_TOKEN', 'tok');
    runBidirectionalInitialSync.mockReset();
    pullAndMergeUserData.mockReset();
    pushUserData.mockReset();
    extractUserData.mockReset();
    runBidirectionalInitialSync.mockResolvedValue({ pullOk: true, pushOk: true, skipped: false });
    pullAndMergeUserData.mockResolvedValue(true);
    pushUserData.mockResolvedValue(undefined);
    startUserDataPolling.mockReturnValue(vi.fn());
    extractUserData.mockResolvedValue({
      focusLog: [], workoutLog: [], appKv: [{ key: 'k', value: 'v', updated_at: 1 }], nutritionConfig: null,
      nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
      streakActivities: [], streakLogCells: [], streakActivityMeta: [],
      waterConfig: null, waterEntries: []
    });
  });

  it('runCompanionInitialSync delegates to shared bidirectional sync', async () => {
    await initCompanionStorage();
    const result = await runCompanionInitialSync();
    expect(result.pullOk).toBe(true);
    expect(runBidirectionalInitialSync).toHaveBeenCalledWith(expect.objectContaining({
      logLabel: 'companion',
      serverUrl: 'https://mgmt.levier.cc',
      serverToken: 'tok'
    }));
  });

  it('does not push during initial sync before bootstrap gate opens', async () => {
    vi.useFakeTimers();
    let releaseSync: () => void = () => {};
    const syncBlocked = new Promise<void>((r) => { releaseSync = r; });
    runBidirectionalInitialSync.mockImplementation(async () => {
      await syncBlocked;
      return { pullOk: true, pushOk: true, skipped: false };
    });
    const db = await initCompanionStorage();
    const syncPromise = runCompanionInitialSync();
    await db.execute('INSERT INTO app_kv (key, value, updated_at) VALUES (?, ?, ?)', ['k', 'v', Date.now()]);
    await vi.advanceTimersByTimeAsync(2500);
    expect(pushUserData).not.toHaveBeenCalled();
    releaseSync();
    await syncPromise;
    vi.useRealTimers();
  });

  it('startCompanionForegroundPull registers periodic user-data polling', async () => {
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    await initCompanionStorage();
    const stop = startCompanionForegroundPull();
    expect(startUserDataPolling).toHaveBeenCalledWith({
      pull: expect.any(Function),
      shouldPoll: expect.any(Function)
    });
    stop();
  });
});
