import { useEffect, useState, type ComponentType } from 'react';
import SyncBootScreen, { type SyncBootPhase } from '@/components/SyncBootScreen';

export default function CompanionBoot() {
  const [phase, setPhase] = useState<SyncBootPhase>('local');
  const [error, setError] = useState<string | null>(null);
  const [App, setApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [storage, appMod] = await Promise.all([
          import('./platform/storage'),
          import('./App')
        ]);
        if (cancelled) return;
        setPhase('local');
        await storage.initCompanionStorage();
        if (cancelled) return;
        setPhase('sync');
        const syncResult = await storage.runCompanionInitialSync();
        if (cancelled) return;
        if (!syncResult.pullOk && !syncResult.skipped) {
          console.error('[data-sync] companion initial sync failed', syncResult);
        }
        storage.startCompanionForegroundPull();
        // Recovery hooks for Sync health card / Safari console
        window.__mgmtCompanionPush = () => storage.pushCompanionSnapshotToServer();
        window.__mgmtCompanionPull = () => storage.pullCompanionSnapshotFromServer();
        setApp(() => appMod.App);
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        console.error('[companion] boot failed:', e);
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (phase !== 'ready' || !App) return <SyncBootScreen phase={phase} error={error} />;
  return <App />;
}
