import { useEffect, useState, type ComponentType } from 'react';
import './companionBoot.css';

type BootPhase = 'local' | 'sync' | 'ready' | 'error';

export default function CompanionBoot() {
  const [phase, setPhase] = useState<BootPhase>('local');
  const [error, setError] = useState<string | null>(null);
  const [App, setApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [storage, , appMod] = await Promise.all([
          import('./platform/storage'),
          import('@/i18n'),
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

  if (phase === 'error') {
    return (
      <div className="companion-boot companion-boot--error" role="alert">
        <p className="companion-boot__title">Could not start</p>
        <p className="companion-boot__detail">{error}</p>
      </div>
    );
  }

  if (phase !== 'ready' || !App) {
    const detail = phase === 'sync' ? 'Getting data from server…' : 'Opening local storage…';
    return (
      <div className="companion-boot" aria-busy="true" aria-live="polite">
        <div className="companion-boot__spinner" aria-hidden="true" />
        <p className="companion-boot__title">Management</p>
        <p className="companion-boot__detail">{detail}</p>
      </div>
    );
  }

  return <App />;
};
