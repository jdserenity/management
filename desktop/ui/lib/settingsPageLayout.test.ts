import { describe, expect, it } from 'vitest';
import {
  COMPANION_SESSION_ALERT_KEYS,
  DESKTOP_SESSION_ALERT_KEYS,
  DESKTOP_SETTINGS_TABS,
  sessionAlertKeysForSurface
} from './settingsPageLayout';

describe('settingsPageLayout', () => {
  it('desktop settings use four tabs', () => {
    expect(DESKTOP_SETTINGS_TABS).toEqual(['general', 'alerts', 'posture', 'about']);
  });

  it('companion exposes only sound-related alert prefs', () => {
    expect(COMPANION_SESSION_ALERT_KEYS).toEqual(['sound', 'countdownSound']);
    expect(COMPANION_SESSION_ALERT_KEYS).not.toContain('trayTimer');
    expect(COMPANION_SESSION_ALERT_KEYS).not.toContain('dockBounce');
  });

  it('desktop exposes full session alert prefs', () => {
    expect(DESKTOP_SESSION_ALERT_KEYS).toContain('notify');
    expect(DESKTOP_SESSION_ALERT_KEYS).toContain('trayTimer');
  });

  it('sessionAlertKeysForSurface picks by surface', () => {
    expect(sessionAlertKeysForSurface('companion')).toBe(COMPANION_SESSION_ALERT_KEYS);
    expect(sessionAlertKeysForSurface('desktop')).toBe(DESKTOP_SESSION_ALERT_KEYS);
  });
});
