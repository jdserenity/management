import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/appRuntime', () => ({ getAppKind: vi.fn(() => 'desktop') }));
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }));
vi.mock('@mgmt/sync', () => ({
  extractUserData: vi.fn(),
  pushUserData: vi.fn()
}));

import { getAppKind } from '@/lib/appRuntime';
import { getDb } from '@/lib/db';
import { extractUserData, pushUserData } from '@mgmt/sync';
import { pushLocalDataToServerIfDesktop } from './dataSync';

describe('pushLocalDataToServerIfDesktop', () => {
  beforeEach(() => {
    vi.mocked(getAppKind).mockReturnValue('desktop');
    vi.mocked(getDb).mockResolvedValue({ select: vi.fn(), execute: vi.fn() });
    vi.mocked(extractUserData).mockResolvedValue({ focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null, nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [], streakActivities: [], streakLogCells: [], streakActivityMeta: [] });
    vi.mocked(pushUserData).mockResolvedValue(undefined);
    vi.stubEnv('VITE_SERVER_URL', 'https://mgmt.levier.cc');
    vi.stubEnv('VITE_SERVER_TOKEN', 'tok');
  });

  it('pushes on desktop', async () => {
    await pushLocalDataToServerIfDesktop();
    expect(pushUserData).toHaveBeenCalledWith('https://mgmt.levier.cc', 'tok', expect.any(Object));
  });
});
