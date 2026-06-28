import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchUserData, hydrateDbFromServer, hydrateDb, mergeUserData, pushUserData, extractUserData } = vi.hoisted(() => ({
  fetchUserData: vi.fn(),
  hydrateDbFromServer: vi.fn(),
  hydrateDb: vi.fn(),
  mergeUserData: vi.fn(),
  pushUserData: vi.fn(),
  extractUserData: vi.fn()
}));

vi.mock('@mgmt/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mgmt/sync')>();
  return { ...actual, fetchUserData, hydrateDbFromServer, hydrateDb, mergeUserData, pushUserData, extractUserData };
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

const emptyUserData = () => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: []
});

describe('companion storage sync', () => {
  beforeEach(() => {
    resetCompanionStorageForTests();
    vi.stubEnv('VITE_SERVER_URL', 'https://mgmt.levier.cc');
    vi.stubEnv('VITE_SERVER_TOKEN', 'tok');
    fetchUserData.mockReset();
    hydrateDbFromServer.mockReset();
    hydrateDb.mockReset();
    mergeUserData.mockReset();
    pushUserData.mockReset();
    extractUserData.mockReset();
    fetchUserData.mockResolvedValue({ ...emptyUserData() });
    hydrateDbFromServer.mockResolvedValue('hydrated');
    hydrateDb.mockResolvedValue(undefined);
    mergeUserData.mockImplementation((_local, server) => server);
    pushUserData.mockResolvedValue(undefined);
    extractUserData.mockResolvedValue({ ...emptyUserData() });
  });

  it('runCompanionInitialSync merges and uploads when both sides have data', async () => {
    const local = { ...emptyUserData(), appKv: [{ key: 'k', value: 'v', updated_at: 1 }] };
    const server = {
      ...emptyUserData(),
      streakActivities: [{ id: 'a1', name: 'Run', description: null, frequency: 'daily', weekly_target: null, scheduled_days_json: null, can_fail: 0, archived_at: null, sort_order: 0, extra_calories: null, extra_protein: null, extra_water_ml: null }]
    };
    fetchUserData.mockResolvedValue(server);
    extractUserData.mockResolvedValue(local);
    await initCompanionStorage();
    const result = await runCompanionInitialSync();
    expect(result.pullOk).toBe(true);
    expect(mergeUserData).toHaveBeenCalledWith(local, server);
    expect(hydrateDb).toHaveBeenCalled();
    expect(pushUserData).toHaveBeenCalled();
  });

  it('runCompanionInitialSync uploads local data when server snapshot is empty', async () => {
    const local = {
      ...emptyUserData(),
      streakActivities: [{ id: 'a1', name: 'Run', description: null, frequency: 'daily', weekly_target: null, scheduled_days_json: null, can_fail: 0, archived_at: null, sort_order: 0, extra_calories: null, extra_protein: null, extra_water_ml: null }],
      appKv: [{ key: 'k', value: 'v', updated_at: 1 }]
    };
    fetchUserData.mockResolvedValue({ ...emptyUserData() });
    extractUserData.mockResolvedValue(local);
    hydrateDbFromServer.mockResolvedValue('kept-local');
    await initCompanionStorage();
    const result = await runCompanionInitialSync();
    expect(result.pullOk).toBe(true);
    expect(pushUserData).toHaveBeenCalled();
  });

  it('defers debounced push until initial sync completes', async () => {
    vi.useFakeTimers();
    let releasePull: () => void = () => {};
    const pullBlocked = new Promise<void>((r) => { releasePull = r; });
    fetchUserData.mockImplementation(async () => {
      await pullBlocked;
      return { ...emptyUserData() };
    });
    extractUserData.mockResolvedValue({
      ...emptyUserData(),
      appKv: [{ key: 'k', value: 'v', updated_at: 1 }]
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
