import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  applyHideToMenuBarOnCloseFromPref,
  getHideToMenuBarOnClosePref,
  setHideToMenuBarOnClosePref,
} from './hideToMenuBarOnClosePref';

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

describe('hideToMenuBarOnClosePref', () => {
  beforeEach(() => {
    kvStore.clear();
  });

  it('defaults to off when unset in app_kv', async () => {
    expect(await getHideToMenuBarOnClosePref()).toBe(false);
  });

  it('persists enabled state in app_kv', async () => {
    await setHideToMenuBarOnClosePref(true);
    expect(await getHideToMenuBarOnClosePref()).toBe(true);
    await setHideToMenuBarOnClosePref(false);
    expect(await getHideToMenuBarOnClosePref()).toBe(false);
  });

  it('applyHideToMenuBarOnCloseFromPref invokes Rust with saved value', async () => {
    await setHideToMenuBarOnClosePref(true);
    const calls: boolean[] = [];
    const enabled = await applyHideToMenuBarOnCloseFromPref(async (v) => {
      calls.push(v);
    });
    expect(enabled).toBe(true);
    expect(calls).toEqual([true]);
  });
});
