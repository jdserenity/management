import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchUserData, hydrateDb } = vi.hoisted(() => ({
  fetchUserData: vi.fn(),
  hydrateDb: vi.fn()
}));

vi.mock('@mgmt/sync', () => ({
  fetchUserData,
  hydrateDb,
  wrapWithDataSync: (db: unknown) => db
}));
vi.mock('@/lib/db', () => ({ registerSqlBackend: vi.fn() }));
vi.mock('./sqlJsStorage', () => ({
  createCompanionSqlJsDatabase: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() }))
}));

import { initCompanionStorage, pullCompanionSnapshotFromServer } from './storage';

describe('companion storage pull', () => {
  beforeEach(() => {
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

  it('pullCompanionSnapshotFromServer returns false without server creds', async () => {
    vi.stubEnv('VITE_SERVER_URL', '');
    await initCompanionStorage();
    const ok = await pullCompanionSnapshotFromServer();
    expect(ok).toBe(false);
  });
});
