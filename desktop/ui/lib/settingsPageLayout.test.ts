import { describe, expect, it } from 'vitest';
import { FEATURE_POSTURE, FEATURE_WORK } from './features';
import {
  COMPANION_SESSION_ALERT_KEYS,
  DESKTOP_SESSION_ALERT_KEYS,
  desktopSettingsTabs,
  sessionAlertKeysForSurface
} from './settingsPageLayout';

describe('settingsPageLayout', () => {
  it('desktop settings omit parked Work and Posture tabs', () => {
    expect(desktopSettingsTabs()).toEqual(['general', 'about']);
  });

  it('desktop settings tabs follow the feature switches', () => {
    const expected = [
      'general',
      ...(FEATURE_WORK ? (['alerts'] as const) : []),
      ...(FEATURE_POSTURE ? (['posture'] as const) : []),
      'about'
    ];
    expect(desktopSettingsTabs()).toEqual(expected);
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
