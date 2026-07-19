import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';
import { isPostureBatterySavingModeEnabled, savePostureBatterySavingMode } from './postureDetectionPrefs';

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  });
  return store;
}

describe('postureDetectionPrefs', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('defaults battery-saving mode on when unset', () => {
    expect(isPostureBatterySavingModeEnabled()).toBe(true);
  });

  it('honors an explicit disabled battery-saving mode', () => {
    localStorage.setItem(MGMT_LS.batterySavingMode, 'false');
    expect(isPostureBatterySavingModeEnabled()).toBe(false);
  });

  it('saves battery-saving mode changes', () => {
    savePostureBatterySavingMode(false);
    expect(isPostureBatterySavingModeEnabled()).toBe(false);
    savePostureBatterySavingMode(true);
    expect(isPostureBatterySavingModeEnabled()).toBe(true);
  });
});
