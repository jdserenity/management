// src/components/daily/DailyStretchSections.tsx

import { useCallback, useMemo } from 'react';
import StretchSection from '@/components/daily/StretchSection';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import { useSession } from '@/context/SessionContext';
import { listScheduledStretches } from '@/lib/stretchCreator/stretchCreator';
import { loadStretchDefinitions } from '@/lib/stretchCreator/stretchCreatorDb';

export default function DailyStretchSections() {
  const { workoutCustomizePrefs } = useSession();
  const load = useCallback(
    () => loadStretchDefinitions(workoutCustomizePrefs),
    [workoutCustomizePrefs]
  );
  const { data: stretches, loadError, storageReady } = useAppDataLoad(
    load,
    'Failed to load stretches',
    { intervalMs: null, listenSync: false }
  );

  const scheduled = useMemo(() => (stretches ? listScheduledStretches(stretches) : []), [stretches]);

  if (!storageReady) return null;
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
