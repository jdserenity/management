import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  getAppPresenceModePref,
  setAppPresenceModePref,
  type AppPresenceMode
} from '@/lib/appPresencePref';
import { getHideToMenuBarOnClosePref, setHideToMenuBarOnClosePref } from '@/lib/hideToMenuBarOnClosePref';

export default function AppPresenceSettingsCard() {
  const { t } = useTranslation();
  const [menuBarOnly, setMenuBarOnly] = useState(false);
  const [hideToMenuBarOnClose, setHideToMenuBarOnClose] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getAppPresenceModePref(), getHideToMenuBarOnClosePref()])
      .then(([mode, hideOnClose]) => {
        setMenuBarOnly(mode === 'menu_bar');
        setHideToMenuBarOnClose(hideOnClose);
        setLoaded(true);
      })
      .catch(console.error);
  }, []);

  const applyMode = useCallback(async (mode: AppPresenceMode) => {
    await setAppPresenceModePref(mode);
    await invoke('set_app_presence_mode', { mode });
  }, []);

  const applyHideOnClose = useCallback(async (enabled: boolean) => {
    await setHideToMenuBarOnClosePref(enabled);
    await invoke('set_hide_to_menu_bar_on_close', { enabled });
  }, []);

  const handleMenuBarToggle = (checked: boolean) => {
    const mode: AppPresenceMode = checked ? 'menu_bar' : 'dock';
    setMenuBarOnly(checked);
    applyMode(mode).catch(console.error);
  };

  const handleHideOnCloseToggle = (checked: boolean) => {
    setHideToMenuBarOnClose(checked);
    applyHideOnClose(checked).catch(console.error);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.appPresenceTitle', 'App icon location')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="font-medium">{t('settings.menuBarOnly', 'Menu bar only')}</span>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.menuBarOnlyDesc',
                'Off: Management appears in the Dock and App Switcher. On: icon stays in the menu bar; closing the window hides the app instead of quitting.'
              )}
            </p>
          </div>
          <Switch checked={menuBarOnly} onCheckedChange={handleMenuBarToggle} disabled={!loaded} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="font-medium">{t('settings.hideToMenuBarOnClose', 'Hide to menu bar on close')}</span>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.hideToMenuBarOnCloseDesc',
                'When off, closing the window quits the app (Dock mode). When on, the close button hides the window; use the menu bar icon to reopen or quit.'
              )}
            </p>
          </div>
          <Switch
            checked={hideToMenuBarOnClose}
            onCheckedChange={handleHideOnCloseToggle}
            disabled={!loaded || menuBarOnly}
          />
        </div>
      </CardContent>
    </Card>
  );
}
