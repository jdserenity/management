import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function UpdateSettingsCard() {
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
      console.error('Update check failed:', error);
      setIsChecking(false);
      setIsDownloading(false);
      setIsInstalling(false);
    }
  };

  const handleRestart = async () => {
    try {
      await invoke('restart_app');
    } catch (error) {
      console.error('Failed to restart app:', error);
      alert('Please restart the app manually.');
    }
  };

  return (
    <section className="plugin-panel space-y-3">
      <h2 className="plugin-panel-title">Updates</h2>
      <div className="space-y-4">
        <p className="text-sm plugin-muted">Check for new versions and install updates automatically.</p>
        <Button onClick={checkForUpdates} disabled={busy}>
          {isChecking ? 'Checking for updates…' : 'Check for updates'}
        </Button>
        {updateInfo ? <p className="text-sm">Update found: {updateInfo.version} ({updateInfo.date})</p> : null}
        {isDownloading ? (
          <div className="space-y-2">
            <p className="text-sm">Downloading… {progress}%</p>
            <Progress value={progress} className="w-full" />
          </div>
        ) : null}
        {isInstalling ? <p className="text-sm">Installing…</p> : null}
        {installed ? (
          <div className="space-y-2">
            <p className="text-sm">Update installed. Restart to finish.</p>
            <Button onClick={handleRestart} variant="outline">Restart app</Button>
          </div>
        ) : null}
        {checkedUpToDate ? <p className="text-sm plugin-muted">You are up to date.</p> : null}
      </div>
    </section>
  );
}
