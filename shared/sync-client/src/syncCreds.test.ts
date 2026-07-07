import { describe, expect, it, vi } from 'vitest';
import { getBuildTimeSyncCreds } from './syncCreds';

describe('getBuildTimeSyncCreds', () => {
  it('reads VITE_SERVER_URL and VITE_SERVER_TOKEN from build env', () => {
    vi.stubEnv('VITE_SERVER_URL', 'https://mgmt.levier.cc');
    vi.stubEnv('VITE_SERVER_TOKEN', 'secret');
    expect(getBuildTimeSyncCreds()).toEqual({ serverUrl: 'https://mgmt.levier.cc', serverToken: 'secret' });
  });

  it('returns undefined for blank values', () => {
    vi.stubEnv('VITE_SERVER_URL', '  ');
    vi.stubEnv('VITE_SERVER_TOKEN', '');
    expect(getBuildTimeSyncCreds()).toEqual({ serverUrl: undefined, serverToken: undefined });
  });
});
