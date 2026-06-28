import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchUserData, hydrateDb, pushUserData, extractUserData } = vi.hoisted(() => ({
  fetchUserData: vi.fn(),
  hydrateDb: vi.fn(),
  pushUserData: vi.fn(),
  extractUserData: vi.fn()
}));

vi.mock('@mgmt/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mgmt/sync')>();
  return { ...actual, fetchUserData, hydrateDb, pushUserData, extractUserData };
});
vi.mock('@/lib/db', () => ({ registerSqlBackend: vi.fn() }));
vi.mock('./sqlJsStorage', () => ({
  createCompanionSqlJsDatabase: vi.fn(async () => ({
    select: vi.fn(async (q: string) => {
      if (q.includes('FROM focus_log')) return [];
      if (q.includes('FROM workout_log')) return [];
      if (q.includes('FROM app_kv')) return [];
      if (q.includes('FROM nutrition_config')) return [];
      if (q.includes('FROM nutrition_staples')) return [];
      if (q.includes('FROM nutrition_regulars')) return [];
      if (q.includes('FROM nutrition_entries')) return [];
      if (q.includes('FROM streak_activities')) return [];
      if (q.includes('FROM streak_log_cells')) return [];
      if (q.includes('FROM streak_activity_meta')) return [];
      if (q.includes('FROM water_config')) return [];
      if (q.includes('FROM water_entries')) return [];
      return [];
    }),
    execute: vi.fn(async () => ({ lastInsertId: 0, rowsAffected: 1 }))
  }))
}));

import {
  initCompanionStorage,
  pullCompanionSnapshotFromServer,
  resetCompanionStorageForTests,
  runCompanionInitialSync
} from './storage';

describe('companion storage sync', () => {
  beforeEach(() => {
    resetCompanionStorageForTests();
    vi.stubEnv('VITE_SERVER_URL', 'https://mgmt.levier.cc');
    vi.stubEnv('VITE_SERVER_TOKEN', 'tok');
    fetchUserData.mockReset();
    hydrateDb.mockReset();
    pushUserData.mockReset();
    extractUserData.mockReset();
    fetchUserData.mockResolvedValue({ streakActivities: [] });
    hydrateDb.mockResolvedValue(undefined);
    pushUserData.mockResolvedValue(undefined);
    extractUserData.mockResolvedValue({ streakActivities: [] });
  });

  it('runCompanionInitialSync pulls then pushes', async () => {
    await initCompanionStorage();
    const result = await runCompanionInitialSync();
    expect(result.pullOk).toBe(true);
    expect(result.pushOk).toBe(true);
    expect(fetchUserData).toHaveBeenCalled();
    expect(pushUserData).toHaveBeenCalled();
  });

  it('defers debounced push until initial sync completes', async () => {
    vi.useFakeTimers();
    let releasePull: () => void = () => {};
    const pullBlocked = new Promise<void>((r) => { releasePull = r; });
    fetchUserData.mockImplementation(async () => {
      await pullBlocked;
      return { streakActivities: [] };
    });
    const db = await initCompanionStorage();
    const syncPromise = runCompanionInitialSync();
    await db.execute('INSERT INTO app_kv (key, value, updated_at) VALUES (?, ?, ?)', ['k', 'v', Date.now()]);
    await vi.advanceTimersByTimeAsync(2500);
    expect(pushUserData).not.toHaveBeenCalled();
    releasePull();
    await syncPromise;
    await vi.advanceTimersByTimeAsync(2500);
    expect(pushUserData).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('pullCompanionSnapshotFromServer returns false without server creds', async () => {
    vi.stubEnv('VITE_SERVER_URL', '');
    await initCompanionStorage();
    const ok = await pullCompanionSnapshotFromServer();
    expect(ok).toBe(false);
  });
});
