import { getDb } from '@/lib/db';

export const KV_APP_PRESENCE_MODE = 'app_presence_mode_v1';
export type AppPresenceMode = 'dock' | 'menu_bar';

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

const parseMode = (raw: string | null): AppPresenceMode => (raw === 'menu_bar' ? 'menu_bar' : 'dock');

/** Default: normal app (Dock / App Switcher on macOS). */
export async function getAppPresenceModePref(): Promise<AppPresenceMode> {
  return parseMode(await getKv(KV_APP_PRESENCE_MODE));
}

export async function setAppPresenceModePref(mode: AppPresenceMode): Promise<void> {
  await setKv(KV_APP_PRESENCE_MODE, mode);
}

/** Align Rust activation policy and tray with saved preference (call once on app boot). */
export async function applyAppPresenceFromPref(
  invokePresence: (mode: AppPresenceMode) => Promise<unknown>,
): Promise<AppPresenceMode> {
  const mode = await getAppPresenceModePref();
  await invokePresence(mode);
  return mode;
}
