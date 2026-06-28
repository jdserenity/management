import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/appRuntime', () => ({ getAppKind: vi.fn(() => 'desktop') }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/dataSyncBootstrap', () => ({
  finishDataSyncBootstrap: vi.fn(),
  resetDataSyncBootstrapForTests: vi.fn()
}));
vi.mock('@mgmt/sync', () => ({
  getBuildTimeSyncCreds: vi.fn(),
  runBidirectionalInitialSync: vi.fn(),
  pullAndMergeUserData: vi.fn(),
  pushUserData: vi.fn(),
  extractUserData: vi.fn()
}));

import { getAppKind } from '@/lib/appRuntime';
import { getDb } from '@/lib/db';
import { getBuildTimeSyncCreds, runBidirectionalInitialSync } from '@mgmt/sync';
import { runDesktopInitialSync, resetDesktopDataSyncForTests } from './dataSync';

describe('runDesktopInitialSync', () => {
  beforeEach(() => {
    resetDesktopDataSyncForTests();
    vi.clearAllMocks();
    vi.mocked(getAppKind).mockReturnValue('desktop');
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn(), execute: vi.fn() });
    vi.mocked(getBuildTimeSyncCreds).mockReturnValue({ serverUrl: 'https://mgmt.levier.cc', serverToken: 'tok' });
    vi.mocked(runBidirectionalInitialSync).mockResolvedValue({ pullOk: true, pushOk: true, skipped: false });
  });

  it('runs shared bidirectional sync with build-time creds', async () => {
    await runDesktopInitialSync();
    expect(runBidirectionalInitialSync).toHaveBeenCalledWith({
      logLabel: 'desktop',
      db: expect.anything(),
      serverUrl: 'https://mgmt.levier.cc',
      serverToken: 'tok'
    });
  });
});
