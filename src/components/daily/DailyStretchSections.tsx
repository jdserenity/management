// src/components/daily/DailyStretchSections.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import StretchSection from '@/components/daily/StretchSection';
import { hasAppStorage } from '@/lib/appRuntime';
import { useSession } from '@/context/SessionContext';
import { listScheduledStretches } from '@/lib/stretchCreator/stretchCreator';
import { loadStretchDefinitions } from '@/lib/stretchCreator/stretchCreatorDb';
import type { StretchDefinition } from '@/lib/stretchCreator/stretchCreator';

export default function DailyStretchSections() {
  const { workoutCustomizePrefs } = useSession();
  const [stretches, setStretches] = useState<StretchDefinition[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasAppStorage()) {
      setLoadError(null);
      setStretches(null);
      return;
    }
    try {
      setLoadError(null);
      setStretches(await loadStretchDefinitions(workoutCustomizePrefs));
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load stretches');
    }
  }, [workoutCustomizePrefs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scheduled = useMemo(() => (stretches ? listScheduledStretches(stretches) : []), [stretches]);

  if (!hasAppStorage()) return null;
  if (loadError) return <p className="text-sm text-destructive">Could not load stretches: {loadError}</p>;
  if (!stretches) return null;
  if (scheduled.length === 0) return null;

  return (
    <div className="space-y-6">
      {scheduled.map((stretch) => (
        <StretchSection key={stretch.id} stretch={stretch} />
      ))}
    </div>
  );
}
