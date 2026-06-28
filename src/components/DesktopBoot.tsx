import { useEffect, useState, type ComponentType } from 'react';
import SyncBootScreen, { type SyncBootPhase } from '@/components/SyncBootScreen';
import { getDb } from '@/lib/db';
import { runDesktopInitialSync, startDesktopForegroundPull } from '@/lib/dataSync';

export default function DesktopBoot() {
  const [phase, setPhase] = useState<SyncBootPhase>('local');
  const [error, setError] = useState<string | null>(null);
  const [App, setApp] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setPhase('local');
        await getDb();
        if (cancelled) return;
        setPhase('sync');
        await runDesktopInitialSync();
        if (cancelled) return;
        startDesktopForegroundPull();
        const appMod = await import('@/App');
        if (cancelled) return;
        setApp(() => appMod.default);
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        console.error('[desktop] boot failed:', e);
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (phase !== 'ready' || !App) return <SyncBootScreen phase={phase} error={error} />;
  return <App />;
}
