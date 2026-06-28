import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/appRuntime', () => ({ getAppKind: vi.fn(() => 'desktop') }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/syncServerConfig', () => ({ loadSyncServerConfig: vi.fn() }));
vi.mock('@/lib/dataSyncBootstrap', () => ({
  finishDataSyncBootstrap: vi.fn(),
  resetDataSyncBootstrapForTests: vi.fn()
}));
vi.mock('@mgmt/sync', () => ({
  dispatchDataSyncRefresh: vi.fn(),
  extractUserData: vi.fn(),
  fetchUserData: vi.fn(),
  hydrateDb: vi.fn(),
  hydrateDbFromServer: vi.fn(),
  logSyncInfo: vi.fn(),
  mergeUserData: vi.fn(),
  pushUserData: vi.fn(),
  summarizeUserDataCounts: vi.fn(() => ({})),
  totalUserDataRows: vi.fn((d) => (d.streakLogCells?.length ?? 0) + (d.appKv?.length ?? 0))
}));

import { getAppKind } from '@/lib/appRuntime';
import { getDb } from '@/lib/db';
import { loadSyncServerConfig } from '@/lib/syncServerConfig';
import {
  dispatchDataSyncRefresh,
  extractUserData,
  fetchUserData,
  hydrateDb,
  hydrateDbFromServer,
  mergeUserData,
  pushUserData
} from '@mgmt/sync';
import { runDesktopInitialSync, resetDesktopDataSyncForTests } from './dataSync';

const empty = () => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: []
});

describe('runDesktopInitialSync', () => {
  beforeEach(() => {
    resetDesktopDataSyncForTests();
    vi.clearAllMocks();
    vi.mocked(getAppKind).mockReturnValue('desktop');
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn(), execute: vi.fn() });
    vi.mocked(loadSyncServerConfig).mockResolvedValue({ serverUrl: 'https://mgmt.levier.cc', serverToken: 'tok' });
    vi.mocked(extractUserData).mockResolvedValue(empty());
    vi.mocked(fetchUserData).mockResolvedValue(empty());
    vi.mocked(hydrateDbFromServer).mockResolvedValue('hydrated');
    vi.mocked(hydrateDb).mockResolvedValue(undefined);
    vi.mocked(mergeUserData).mockReturnValue(empty());
    vi.mocked(pushUserData).mockResolvedValue(undefined);
  });

  it('pulls server data when local is empty', async () => {
    const server = { ...empty(), streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'success', updated_at: '2026-06-28T12:00:00.000Z' }] };
    vi.mocked(fetchUserData).mockResolvedValue(server);
    await runDesktopInitialSync();
    expect(hydrateDbFromServer).toHaveBeenCalled();
    expect(pushUserData).not.toHaveBeenCalled();
    expect(dispatchDataSyncRefresh).toHaveBeenCalled();
  });

  it('pushes local data when server is empty', async () => {
    const local = { ...empty(), appKv: [{ key: 'k', value: 'v', updated_at: 1 }] };
    vi.mocked(extractUserData).mockResolvedValue(local);
    await runDesktopInitialSync();
    expect(pushUserData).toHaveBeenCalledWith('https://mgmt.levier.cc', 'tok', local);
    expect(hydrateDbFromServer).not.toHaveBeenCalled();
  });

  it('merges and uploads when both sides have data', async () => {
    const local = { ...empty(), appKv: [{ key: 'k', value: 'local', updated_at: 1 }] };
    const server = { ...empty(), streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'success', updated_at: '2026-06-28T12:00:00.000Z' }] };
    const merged = { ...empty(), streakLogCells: server.streakLogCells };
    vi.mocked(extractUserData).mockResolvedValue(local);
    vi.mocked(fetchUserData).mockResolvedValue(server);
    vi.mocked(mergeUserData).mockReturnValue(merged);
    await runDesktopInitialSync();
    expect(mergeUserData).toHaveBeenCalledWith(local, server);
    expect(hydrateDb).toHaveBeenCalledWith(expect.anything(), merged);
    expect(pushUserData).toHaveBeenCalledWith('https://mgmt.levier.cc', 'tok', merged);
    expect(dispatchDataSyncRefresh).toHaveBeenCalled();
  });
});
