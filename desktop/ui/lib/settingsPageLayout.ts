import type { SessionAlertsPrefs } from '@/lib/sessionAlertsPref';

export type SettingsTabId = 'general' | 'alerts' | 'posture' | 'about';

export const DESKTOP_SETTINGS_TABS: SettingsTabId[] = ['general', 'alerts', 'posture', 'about'];

export type SessionAlertPrefKey = keyof SessionAlertsPrefs;

/** Companion only exposes phone-relevant alert toggles (no tray / dock). */
export const COMPANION_SESSION_ALERT_KEYS: SessionAlertPrefKey[] = ['sound', 'countdownSound'];

/** Desktop shows every session alert preference. */
export const DESKTOP_SESSION_ALERT_KEYS: SessionAlertPrefKey[] = [
  'sound',
  'countdownSound',
  'focusWindow',
  'dockBounce',
  'notify',
  'trayTimer'
];

export const sessionAlertKeysForSurface = (surface: 'desktop' | 'companion'): SessionAlertPrefKey[] =>
  surface === 'companion' ? COMPANION_SESSION_ALERT_KEYS : DESKTOP_SESSION_ALERT_KEYS;
