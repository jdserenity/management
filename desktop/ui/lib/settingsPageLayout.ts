import type { SessionAlertsPrefs } from '@/lib/sessionAlertsPref';
import { FEATURE_POSTURE, FEATURE_WORK } from '@/lib/features';

export type SettingsTabId = 'general' | 'alerts' | 'posture' | 'about';

export const SETTINGS_TAB_LABELS: Record<SettingsTabId, string> = {
  general: 'General',
  alerts: 'Focus & alerts',
  posture: 'Posture',
  about: 'About'
};

export const desktopSettingsTabs = (): SettingsTabId[] => {
  const tabs: SettingsTabId[] = ['general'];
  if (FEATURE_WORK) tabs.push('alerts');
  if (FEATURE_POSTURE) tabs.push('posture');
  tabs.push('about');
  return tabs;
};

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
