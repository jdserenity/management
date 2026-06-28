import { useEffect, useState, type ComponentType } from 'react';
import './companionBoot.css';

type BootState = 'loading' | 'ready' | 'error';

export default function CompanionBoot() {
  const [state, setState] = useState<BootState>('loading');
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
        await storage.initCompanionStorage();
        storage.startCompanionForegroundPull();
        setApp(() => appMod.App);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        console.error('[companion] boot failed:', e);
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === 'error') {
    return (
      <div className="companion-boot companion-boot--error" role="alert">
        <p className="companion-boot__title">Could not start</p>
        <p className="companion-boot__detail">{error}</p>
      </div>
    );
  }

  if (state !== 'ready' || !App) {
    return (
      <div className="companion-boot" aria-busy="true" aria-live="polite">
        <div className="companion-boot__spinner" aria-hidden="true" />
        <p className="companion-boot__title">Management Companion</p>
        <p className="companion-boot__detail">Loading your data…</p>
      </div>
    );
  }

  return <App />;
}
