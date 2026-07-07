import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KV_SESSION_TRAY_TIMER,
  loadSessionAlertsPrefs,
  saveSessionAlertsPref
} from '@/lib/sessionAlertsPref';

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

describe('sessionAlertsPref', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults when unset', async () => {
    const d = await loadSessionAlertsPrefs();
    expect(d.sound).toBe(true);
    expect(d.countdownSound).toBe(true);
    expect(d.focusWindow).toBe(true);
    expect(d.dockBounce).toBe(false);
    expect(d.notify).toBe(false);
    expect(d.trayTimer).toBe(false);
  });

  it('persists tray timer flag', async () => {
    await saveSessionAlertsPref('trayTimer', true);
    expect(store.get(KV_SESSION_TRAY_TIMER)).toBe('1');
    expect((await loadSessionAlertsPrefs()).trayTimer).toBe(true);
  });
});
