import { getAppKv, setAppKv } from '@/lib/appKv';

export const KV_APP_PRESENCE_MODE = 'app_presence_mode_v1';
export type AppPresenceMode = 'dock' | 'menu_bar';

const parseMode = (raw: string | null): AppPresenceMode => (raw === 'menu_bar' ? 'menu_bar' : 'dock');

/** Default: normal app (Dock / App Switcher on macOS). */
export async function getAppPresenceModePref(): Promise<AppPresenceMode> {
  return parseMode(await getAppKv(KV_APP_PRESENCE_MODE));
}

export async function setAppPresenceModePref(mode: AppPresenceMode): Promise<void> {
  await setAppKv(KV_APP_PRESENCE_MODE, mode);
}

/** Align Rust activation policy and tray with saved preference (call once on app boot). */
export async function applyAppPresenceFromPref(
  invokePresence: (mode: AppPresenceMode) => Promise<unknown>
): Promise<AppPresenceMode> {
  const mode = await getAppPresenceModePref();
  await invokePresence(mode);
  return mode;
}
