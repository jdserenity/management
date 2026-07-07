import { getDb } from '@/lib/db';

export const KV_HIDE_TO_MENU_BAR_ON_CLOSE = 'hide_to_menu_bar_on_close_v1';

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

const parseEnabled = (raw: string | null): boolean => raw === '1' || raw === 'true';

/** Default off: closing the window quits or closes normally in Dock mode. */
export async function getHideToMenuBarOnClosePref(): Promise<boolean> {
  return parseEnabled(await getKv(KV_HIDE_TO_MENU_BAR_ON_CLOSE));
}

export async function setHideToMenuBarOnClosePref(enabled: boolean): Promise<void> {
  await setKv(KV_HIDE_TO_MENU_BAR_ON_CLOSE, enabled ? '1' : '0');
}

/** Sync Rust close-to-tray behavior with saved preference (call once on app boot). */
export async function applyHideToMenuBarOnCloseFromPref(
  invokePref: (enabled: boolean) => Promise<unknown>,
): Promise<boolean> {
  const enabled = await getHideToMenuBarOnClosePref();
  await invokePref(enabled);
  return enabled;
}
