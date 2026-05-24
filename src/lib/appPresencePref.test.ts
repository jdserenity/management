import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  applyAppPresenceFromPref,
  getAppPresenceModePref,
  setAppPresenceModePref,
} from './appPresencePref';

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

describe('appPresencePref', () => {
  beforeEach(() => {
    kvStore.clear();
  });

  it('defaults to dock when unset in app_kv', async () => {
    expect(await getAppPresenceModePref()).toBe('dock');
  });

  it('persists menu_bar mode in app_kv', async () => {
    await setAppPresenceModePref('menu_bar');
    expect(await getAppPresenceModePref()).toBe('menu_bar');
  });

  it('applyAppPresenceFromPref invokes Rust with saved mode', async () => {
    await setAppPresenceModePref('menu_bar');
    const calls: string[] = [];
    const mode = await applyAppPresenceFromPref(async (m) => {
      calls.push(m);
    });
    expect(mode).toBe('menu_bar');
    expect(calls).toEqual(['menu_bar']);
  });
});
