import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeGet = vi.fn();
const storeSet = vi.fn();
const storeSave = vi.fn();
const storeDelete = vi.fn();

vi.mock('@/lib/appRuntime', () => ({ getAppKind: vi.fn(() => 'desktop') }));
vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async () => ({
    get: storeGet,
    set: storeSet,
    save: storeSave,
    delete: storeDelete
  }))
}));

import { getAppKind } from '@/lib/appRuntime';
import { loadSyncServerConfig, resetSyncServerConfigForTests, saveSyncServerConfig } from './syncServerConfig';

describe('syncServerConfig', () => {
  beforeEach(() => {
    resetSyncServerConfigForTests();
    storeGet.mockReset();
    storeSet.mockReset();
    storeSave.mockReset();
    storeDelete.mockReset();
    vi.mocked(getAppKind).mockReturnValue('desktop');
    vi.stubEnv('VITE_SERVER_URL', '');
    vi.stubEnv('VITE_SERVER_TOKEN', '');
  });

  it('reads serverUrl and serverToken from the desktop store', async () => {
    storeGet.mockImplementation(async (key: string) => {
      if (key === 'serverUrl') return 'http://100.93.97.83:8787';
      if (key === 'serverToken') return 'tok';
      return undefined;
    });
    const cfg = await loadSyncServerConfig();
    expect(cfg).toEqual({ serverUrl: 'http://100.93.97.83:8787', serverToken: 'tok' });
  });

  it('seeds the store from VITE_* when the store is empty', async () => {
    vi.stubEnv('VITE_SERVER_URL', 'http://localhost:8787');
    vi.stubEnv('VITE_SERVER_TOKEN', 'dev-tok');
    storeGet.mockResolvedValue(undefined);
    const cfg = await loadSyncServerConfig();
    expect(cfg).toEqual({ serverUrl: 'http://localhost:8787', serverToken: 'dev-tok' });
    expect(storeSet).toHaveBeenCalledWith('serverUrl', 'http://localhost:8787');
    expect(storeSet).toHaveBeenCalledWith('serverToken', 'dev-tok');
    expect(storeSave).toHaveBeenCalled();
  });

  it('updates the store when build env URL/token differ from stored values', async () => {
    vi.stubEnv('VITE_SERVER_URL', 'https://mgmt.levier.cc');
    vi.stubEnv('VITE_SERVER_TOKEN', 'new-tok');
    storeGet.mockImplementation(async (key: string) => {
      if (key === 'serverUrl') return 'http://100.93.97.83:8787';
      if (key === 'serverToken') return 'old-tok';
      return undefined;
    });
    const cfg = await loadSyncServerConfig();
    expect(cfg).toEqual({ serverUrl: 'https://mgmt.levier.cc', serverToken: 'new-tok' });
    expect(storeSet).toHaveBeenCalledWith('serverUrl', 'https://mgmt.levier.cc');
    expect(storeSet).toHaveBeenCalledWith('serverToken', 'new-tok');
    expect(storeSave).toHaveBeenCalled();
  });

  it('saveSyncServerConfig persists values', async () => {
    storeGet.mockResolvedValue(undefined);
    await saveSyncServerConfig({ serverUrl: 'https://mgmt.levier.cc', serverToken: 'secret' });
    expect(storeSet).toHaveBeenCalledWith('serverUrl', 'https://mgmt.levier.cc');
    expect(storeSet).toHaveBeenCalledWith('serverToken', 'secret');
    expect(storeSave).toHaveBeenCalled();
  });
});
