import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DAY_ROLLOVER_HOUR } from '@/lib/dayBoundary';
import { KV_DAY_ROLLOVER_HOUR, loadDayRolloverHourPref, saveDayRolloverHourPref } from '@/lib/dayBoundaryPref';

const store = new Map<string, string>();

vi.mock('@/lib/db', () => ({
  getDb: async () => ({
    select: async (_sql: string, params: [string]) => {
      const v = store.get(params[0]);
      return v === undefined ? [] : [{ value: v }];
    },
    execute: async (_sql: string, params: [string, string]) => {
      store.set(params[0], params[1]);
    }
  })
}));

describe('dayBoundaryPref', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults to 4am when unset', async () => {
    expect(await loadDayRolloverHourPref()).toBe(DEFAULT_DAY_ROLLOVER_HOUR);
  });

  it('persists hour in app_kv', async () => {
    await saveDayRolloverHourPref(6);
    expect(store.get(KV_DAY_ROLLOVER_HOUR)).toBe('6');
    expect(await loadDayRolloverHourPref()).toBe(6);
  });

  it('clamps invalid saves', async () => {
    await saveDayRolloverHourPref(99);
    expect(await loadDayRolloverHourPref()).toBe(23);
  });
});
