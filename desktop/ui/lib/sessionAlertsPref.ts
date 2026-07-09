import { encodeBool01, getAppKv, getAppKvMany, parseBoolLoose, setAppKv } from '@/lib/appKv';

export const KV_SESSION_SOUND = 'session_alert_sound_v1';
export const KV_SESSION_COUNTDOWN_SOUND = 'session_alert_countdown_sound_v1';
export const KV_SESSION_FOCUS_WINDOW = 'session_alert_focus_window_v1';
export const KV_SESSION_DOCK_BOUNCE = 'session_alert_dock_bounce_v1';
export const KV_SESSION_NOTIFY = 'session_alert_notify_v1';
export const KV_SESSION_TRAY_TIMER = 'session_tray_timer_v1';

export interface SessionAlertsPrefs {
  sound: boolean;
  countdownSound: boolean;
  focusWindow: boolean;
  dockBounce: boolean;
  notify: boolean;
  trayTimer: boolean;
}

export const defaultSessionAlertsPrefs = (): SessionAlertsPrefs => ({
  sound: true,
  countdownSound: true,
  focusWindow: true,
  dockBounce: false,
  notify: false,
  trayTimer: false
});

const KEY_BY_FIELD: Record<keyof SessionAlertsPrefs, string> = {
  sound: KV_SESSION_SOUND,
  countdownSound: KV_SESSION_COUNTDOWN_SOUND,
  focusWindow: KV_SESSION_FOCUS_WINDOW,
  dockBounce: KV_SESSION_DOCK_BOUNCE,
  notify: KV_SESSION_NOTIFY,
  trayTimer: KV_SESSION_TRAY_TIMER
};

const FIELDS = Object.keys(KEY_BY_FIELD) as (keyof SessionAlertsPrefs)[];

export const loadSessionAlertsPrefs = async (): Promise<SessionAlertsPrefs> => {
  const d = defaultSessionAlertsPrefs();
  const keys = FIELDS.map((f) => KEY_BY_FIELD[f]);
  const values = await getAppKvMany(keys);
  const out = { ...d };
  FIELDS.forEach((f, i) => {
    out[f] = parseBoolLoose(values[i], d[f]);
  });
  return out;
};

export const SESSION_ALERTS_PREFS_CHANGED = 'mgmt-session-alerts-prefs-changed';

export const notifySessionAlertsPrefsChanged = (): void => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_ALERTS_PREFS_CHANGED));
};

export const saveSessionAlertsPref = async <K extends keyof SessionAlertsPrefs>(
  key: K,
  value: SessionAlertsPrefs[K]
): Promise<void> => {
  await setAppKv(KEY_BY_FIELD[key], encodeBool01(value));
};
