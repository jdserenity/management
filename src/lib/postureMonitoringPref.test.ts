import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  applyPostureMonitoringFromPref,
  isPostureMonitoringEnabledPref,
  resetPostureMonitoringPrefMigrationForTests,
  setPostureMonitoringEnabledPref,
} from './postureMonitoringPref';

const LEGACY_POSTURE_MONITORING_LS_KEY = 'mgmt_posture_monitoring_enabled';

const { kvStore } = vi.hoisted(() => ({ kvStore: new Map<string, string>() }));

vi.mock('@/lib/db', () => ({
  getDb: async () => ({
    select: async (_sql: string, params: [string]) => {
      const v = kvStore.get(params[0]);
      return v !== undefined ? [{ value: v }] : [];
    },
    execute: async (_sql: string, params: [string, string]) => {
      kvStore.set(params[0], params[1]);
    },
  }),
}));

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

describe('postureMonitoringPref', () => {
  beforeEach(() => {
    kvStore.clear();
    mockLocalStorage();
    resetPostureMonitoringPrefMigrationForTests();
  });

  it('defaults to enabled when unset in app_kv', async () => {
    expect(await isPostureMonitoringEnabledPref()).toBe(true);
  });

  it('persists disabled state in app_kv', async () => {
    await setPostureMonitoringEnabledPref(false);
    expect(await isPostureMonitoringEnabledPref()).toBe(false);
  });

  it('persists enabled state in app_kv', async () => {
    await setPostureMonitoringEnabledPref(true);
    expect(await isPostureMonitoringEnabledPref()).toBe(true);
  });

  it('migrates legacy localStorage value into app_kv', async () => {
    localStorage.setItem(LEGACY_POSTURE_MONITORING_LS_KEY, 'false');
    expect(await isPostureMonitoringEnabledPref()).toBe(false);
    expect(localStorage.getItem(LEGACY_POSTURE_MONITORING_LS_KEY)).toBeNull();
  });

  it('applyPostureMonitoringFromPref starts when pref is enabled', async () => {
    const calls: string[] = [];
    await applyPostureMonitoringFromPref(async (cmd) => {
      calls.push(cmd);
    });
    expect(calls).toEqual(['start_monitoring']);
  });

  it('applyPostureMonitoringFromPref stops when pref is disabled', async () => {
    localStorage.setItem(LEGACY_POSTURE_MONITORING_LS_KEY, 'false');
    const calls: string[] = [];
    await applyPostureMonitoringFromPref(async (cmd) => {
      calls.push(cmd);
    });
    expect(calls).toEqual(['stop_monitoring']);
  });
});
