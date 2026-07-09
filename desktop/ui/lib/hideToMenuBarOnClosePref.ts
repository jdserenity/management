import { boolPref } from '@/lib/appKv';

export const KV_HIDE_TO_MENU_BAR_ON_CLOSE = 'hide_to_menu_bar_on_close_v1';

const pref = boolPref(KV_HIDE_TO_MENU_BAR_ON_CLOSE, {
  defaultValue: false,
  mode: 'loose',
  encode: '01'
});

/** Default off: closing the window quits or closes normally in Dock mode. */
export const getHideToMenuBarOnClosePref = (): Promise<boolean> => pref.load();
export const setHideToMenuBarOnClosePref = (enabled: boolean): Promise<void> => pref.save(enabled);

/** Sync Rust close-to-tray behavior with saved preference (call once on app boot). */
export async function applyHideToMenuBarOnCloseFromPref(
  invokePref: (enabled: boolean) => Promise<unknown>
): Promise<boolean> {
  const enabled = await getHideToMenuBarOnClosePref();
  await invokePref(enabled);
  return enabled;
}
