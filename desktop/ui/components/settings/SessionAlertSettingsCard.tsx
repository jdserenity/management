import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  loadSessionAlertsPrefs,
  notifySessionAlertsPrefsChanged,
  saveSessionAlertsPref,
  type SessionAlertsPrefs
} from '@/lib/sessionAlertsPref';
import { sessionAlertKeysForSurface, type SessionAlertPrefKey } from '@/lib/settingsPageLayout';
import { openSystemSettings } from '@/lib/systemSettingsLinks';

type SessionAlertSettingsCardProps = {
  surface: 'desktop' | 'companion';
};

const alertI18n: Record<SessionAlertPrefKey, { title: string; desc: string }> = {
  sound: { title: 'settings.sessionSound', desc: 'settings.sessionSoundDesc' },
  countdownSound: { title: 'settings.sessionCountdownSound', desc: 'settings.sessionCountdownSoundDesc' },
  focusWindow: { title: 'settings.sessionFocusWindow', desc: 'settings.sessionFocusWindowDesc' },
  dockBounce: { title: 'settings.sessionDockBounce', desc: 'settings.sessionDockBounceDesc' },
  notify: { title: 'settings.sessionNotify', desc: 'settings.sessionNotifyDesc' },
  trayTimer: { title: 'settings.sessionTrayTimer', desc: 'settings.sessionTrayTimerDesc' }
};

const alertDefaults: Record<SessionAlertPrefKey, { title: string; desc: string }> = {
  sound: { title: 'Sound alerts', desc: 'Play a short chime when a focus or break phase starts or the flow ends.' },
  countdownSound: { title: '5-second countdown', desc: 'Tick each second during the last 5 seconds before a phase ends.' },
  focusWindow: { title: 'Bring app to front', desc: 'Show and focus the window when a phase changes.' },
  dockBounce: { title: 'Bounce Dock icon', desc: 'When bringing the app to front, also bounce the Dock icon (macOS).' },
  notify: { title: 'System notifications', desc: 'Desktop notification when focus, break, or relax phases start.' },
  trayTimer: { title: 'Show timer in menu bar', desc: 'While a focus flow runs, show a live countdown next to the menu bar icon.' }
};

export default function SessionAlertSettingsCard({ surface }: SessionAlertSettingsCardProps) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<SessionAlertsPrefs | null>(null);
  const keys = sessionAlertKeysForSurface(surface);

  useEffect(() => {
    loadSessionAlertsPrefs().then(setPrefs).catch(console.error);
  }, []);

  const patch = (key: SessionAlertPrefKey, value: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saveSessionAlertsPref(key, value)
      .then(() => {
        if (key === 'trayTimer') void invoke('set_session_tray_timer_enabled', { enabled: value }).catch(console.error);
        notifySessionAlertsPrefsChanged();
      })
      .catch(console.error);
  };

  if (!prefs) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.sessionAlertsTitle', 'Focus & break alerts')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {keys.map((key) => {
          const i18n = alertI18n[key];
          const defaults = alertDefaults[key];
          const disabled = key === 'dockBounce' && !prefs.focusWindow;
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="font-medium">{t(i18n.title, defaults.title)}</span>
                <p className="text-sm text-muted-foreground">{t(i18n.desc, defaults.desc)}</p>
              </div>
              <Switch checked={prefs[key]} onCheckedChange={(v) => patch(key, v)} disabled={disabled} />
            </div>
          );
        })}
        {surface === 'desktop' && prefs.notify ? (
          <p className="text-sm text-muted-foreground">
            {t('settings.notificationGuide', 'If notifications do not arrive, allow Management in system notification settings.')}{' '}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() => void openSystemSettings('notifications')}
            >
              {t('settings.notificationGoTo', 'Open notification settings')}
            </Button>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
