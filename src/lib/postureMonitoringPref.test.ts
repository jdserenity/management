import { describe, expect, it, beforeEach, vi } from 'vitest';
import { isPostureMonitoringEnabledPref, setPostureMonitoringEnabledPref } from './postureMonitoringPref';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    clear: () => store.clear(),
  });
}

describe('postureMonitoringPref', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('defaults to enabled when unset', () => {
    expect(isPostureMonitoringEnabledPref()).toBe(true);
  });

  it('persists disabled state', () => {
    setPostureMonitoringEnabledPref(false);
    expect(localStorage.getItem(MGMT_LS.postureMonitoringEnabled)).toBe('false');
    expect(isPostureMonitoringEnabledPref()).toBe(false);
  });

  it('persists enabled state', () => {
    setPostureMonitoringEnabledPref(true);
    expect(isPostureMonitoringEnabledPref()).toBe(true);
  });
});
