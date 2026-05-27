import { getDb } from '@/lib/db';

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

type AppKvRow = { value: string };

const getKv = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const rows = await db.select<AppKvRow[]>('SELECT value FROM app_kv WHERE key = $1 LIMIT 1', [key]);
  return rows[0]?.value ?? null;
};

const setKv = async (key: string, value: string): Promise<void> => {
  const db = await getDb();
  await db.execute(
    'INSERT INTO app_kv (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, value, Date.now()]
  );
};

const parseBool = (raw: string | null, defaultValue: boolean): boolean => {
  if (raw === null) return defaultValue;
  return raw === '1' || raw.toLowerCase() === 'true';
};

export const loadSessionAlertsPrefs = async (): Promise<SessionAlertsPrefs> => {
  const d = defaultSessionAlertsPrefs();
  const [sound, countdownSound, focusWindow, dockBounce, notify, trayTimer] = await Promise.all([
    getKv(KV_SESSION_SOUND),
    getKv(KV_SESSION_COUNTDOWN_SOUND),
    getKv(KV_SESSION_FOCUS_WINDOW),
    getKv(KV_SESSION_DOCK_BOUNCE),
    getKv(KV_SESSION_NOTIFY),
    getKv(KV_SESSION_TRAY_TIMER)
  ]);
  return {
    sound: parseBool(sound, d.sound),
    countdownSound: parseBool(countdownSound, d.countdownSound),
    focusWindow: parseBool(focusWindow, d.focusWindow),
    dockBounce: parseBool(dockBounce, d.dockBounce),
    notify: parseBool(notify, d.notify),
    trayTimer: parseBool(trayTimer, d.trayTimer)
  };
};

export const SESSION_ALERTS_PREFS_CHANGED = 'mgmt-session-alerts-prefs-changed';

export const notifySessionAlertsPrefsChanged = (): void => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_ALERTS_PREFS_CHANGED));
};

export const saveSessionAlertsPref = async <K extends keyof SessionAlertsPrefs>(
  key: K,
  value: SessionAlertsPrefs[K]
): Promise<void> => {
  const kvKey =
    key === 'sound' ? KV_SESSION_SOUND
    : key === 'countdownSound' ? KV_SESSION_COUNTDOWN_SOUND
    : key === 'focusWindow' ? KV_SESSION_FOCUS_WINDOW
    : key === 'dockBounce' ? KV_SESSION_DOCK_BOUNCE
    : key === 'notify' ? KV_SESSION_NOTIFY
    : KV_SESSION_TRAY_TIMER;
  await setKv(kvKey, value ? '1' : '0');
};
