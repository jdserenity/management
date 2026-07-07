import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function UpdateSettingsCard() {
  const { t } = useTranslation();
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; date: string } | null>(null);
  const [installed, setInstalled] = useState(false);
  const [checkedUpToDate, setCheckedUpToDate] = useState(false);
  const busy = isChecking || isDownloading || isInstalling;

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      setProgress(0);
      setUpdateInfo(null);
      setInstalled(false);
      setCheckedUpToDate(false);
      const update = await check();
      if (update) {
        setUpdateInfo({ version: update.version || '', date: update.date || '' });
        setIsChecking(false);
        setIsDownloading(true);
        let downloaded = 0;
        let contentLength = 0;
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              setProgress(Math.round(contentLength > 0 ? (downloaded / contentLength) * 100 : 0));
              break;
            case 'Finished':
              setIsDownloading(false);
              setIsInstalling(true);
              break;
          }
        });
        setIsInstalling(false);
        setInstalled(true);
      } else {
        setIsChecking(false);
        setCheckedUpToDate(true);
      }
    } catch (error) {
      console.error(t('settings.updateErrorCheck', 'Update check failed:'), error);
      setIsChecking(false);
      setIsDownloading(false);
      setIsInstalling(false);
    }
  };

  const handleRestart = async () => {
    try {
      await invoke('restart_app');
    } catch (error) {
      console.error(t('settings.appErrorRestart', 'Failed to restart app:'), error);
      alert(t('settings.appRestartManual', 'Please restart the app manually.'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.updateTitle', 'Updates')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('settings.updateGuide', 'Check for new versions and install updates automatically.')}
        </p>
        <Button onClick={checkForUpdates} disabled={busy}>
          {isChecking ? t('settings.checkingUpdate', 'Checking for updates…') : t('settings.checkUpdate', 'Check for updates')}
        </Button>
        {updateInfo ? (
          <p className="text-sm">
            {t('settings.updateFound', 'Update found: {{version}} ({{date}})', { version: updateInfo.version, date: updateInfo.date })}
          </p>
        ) : null}
        {isDownloading ? (
          <div className="space-y-2">
            <p className="text-sm">{t('settings.updateDownloading', 'Downloading… {{progress}}%', { progress })}</p>
            <Progress value={progress} className="w-full" />
          </div>
        ) : null}
        {isInstalling ? <p className="text-sm">{t('settings.updateInstalling', 'Installing…')}</p> : null}
        {installed ? (
          <div className="space-y-2">
            <p className="text-sm">{t('settings.updateInstalled', 'Update installed. Restart to finish.')}</p>
            <Button onClick={handleRestart} variant="outline">{t('settings.restartApp', 'Restart app')}</Button>
          </div>
        ) : null}
        {checkedUpToDate ? <p className="text-sm text-muted-foreground">{t('settings.upToDate', 'You are up to date.')}</p> : null}
      </CardContent>
    </Card>
  );
}
