import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchUserData, hydrateDb } = vi.hoisted(() => ({
  fetchUserData: vi.fn(),
  hydrateDb: vi.fn()
}));

vi.mock('@mgmt/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mgmt/sync')>();
  return { ...actual, fetchUserData, hydrateDb };
});
vi.mock('@/lib/db', () => ({ registerSqlBackend: vi.fn() }));
vi.mock('./sqlJsStorage', () => ({
  createCompanionSqlJsDatabase: vi.fn(async () => {
    const rows: Record<string, unknown>[] = [];
    return {
      select: vi.fn(async (q: string) => {
        if (q.includes('FROM focus_log')) return [];
        if (q.includes('FROM workout_log')) return [];
        if (q.includes('FROM app_kv')) return rows.filter((r) => Object.hasOwn(r, 'key'));
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
      execute: vi.fn(async () => {
        return { lastInsertId: 0, rowsAffected: 1 };
      })
    };
  })
}));

import { initCompanionStorage, pullCompanionSnapshotFromServer, resetCompanionStorageForTests } from './storage';

describe('companion storage pull', () => {
  beforeEach(() => {
    resetCompanionStorageForTests();
    vi.stubEnv('VITE_SERVER_URL', 'https://mgmt.levier.cc');
    vi.stubEnv('VITE_SERVER_TOKEN', 'tok');
    fetchUserData.mockReset();
    hydrateDb.mockReset();
    fetchUserData.mockResolvedValue({ streakActivities: [] });
    hydrateDb.mockResolvedValue(undefined);
  });

  it('initCompanionStorage registers db without awaiting server pull', async () => {
    let pullDone = false;
    fetchUserData.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      pullDone = true;
      return { streakActivities: [] };
    });
    await initCompanionStorage();
    expect(pullDone).toBe(false);
    await vi.waitFor(() => expect(pullDone).toBe(true));
    expect(fetchUserData).toHaveBeenCalled();
  });

  it('defers push until initial pull completes', async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    let releasePull: () => void = () => {};
    const pullBlocked = new Promise<void>((r) => { releasePull = r; });
    fetchUserData.mockImplementation(async () => {
      await pullBlocked;
      return { streakActivities: [] };
    });
    const db = await initCompanionStorage();
    await db.execute('INSERT INTO app_kv (key, value, updated_at) VALUES (?, ?, ?)', ['k', 'v', Date.now()]);
    await vi.advanceTimersByTimeAsync(2500);
    expect(mockFetch).not.toHaveBeenCalled();
    releasePull();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2500);
    expect(mockFetch).toHaveBeenCalled();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('pullCompanionSnapshotFromServer returns false without server creds', async () => {
    vi.stubEnv('VITE_SERVER_URL', '');
    await initCompanionStorage();
    const ok = await pullCompanionSnapshotFromServer();
    expect(ok).toBe(false);
  });
});
