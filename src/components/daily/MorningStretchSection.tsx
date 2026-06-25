// src/components/daily/MorningStretchSection.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/context/SessionContext';
import { isTauri } from '@/lib/isTauri';
import {
  isMorningStretchCompletedToday,
  labelForMorningStretchRef,
  morningStretchCompletionRatio,
  resolveMorningStretchExercises,
  shouldShowMorningStretchSection,
  type MorningStretchRoutine
} from '@/lib/morningStretch/morningStretch';
import { loadMorningStretchRoutine } from '@/lib/morningStretch/morningStretchDb';
import { loadMorningStretchPrefs, type MorningStretchPrefs } from '@/lib/morningStretch/morningStretchPref';
import { isPhaseLongEnoughToLog } from '@/lib/sessionProgress';
import { formatClock, formatExerciseAmount } from '@/lib/workoutPlanner';
import { Play, Sunrise, X } from 'lucide-react';

type ViewMode = 'summary' | 'run';

export default function MorningStretchSection() {
  const { workoutCustomizePrefs, workoutLogs, dayRolloverHour, logMorningStretchCompletion } = useSession();
  const [routine, setRoutine] = useState<MorningStretchRoutine | null>(null);
  const [stretchPrefs, setStretchPrefs] = useState<MorningStretchPrefs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [runElapsedSeconds, setRunElapsedSeconds] = useState(0);
  const runStartedAtRef = useRef<number | null>(null);

  const resolvedExercises = useMemo(
    () => (routine ? resolveMorningStretchExercises(routine, workoutCustomizePrefs) : []),
    [routine, workoutCustomizePrefs]
  );
  const doneToday = useMemo(
    () => isMorningStretchCompletedToday(workoutLogs, nowMs, dayRolloverHour),
    [workoutLogs, dayRolloverHour, nowMs]
  );
  const activeRun = viewMode === 'run';
  const visible = stretchPrefs
    ? shouldShowMorningStretchSection({
        prefs: stretchPrefs,
        completedToday: doneToday,
        nowTimestamp: nowMs,
        activeRun
      })
    : false;

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      setLoadError(null);
      setRoutine(null);
      setStretchPrefs(null);
      return;
    }
    try {
      setLoadError(null);
      const [nextRoutine, nextPrefs] = await Promise.all([
        loadMorningStretchRoutine(workoutCustomizePrefs),
        loadMorningStretchPrefs()
      ]);
      setRoutine(nextRoutine);
      setStretchPrefs(nextPrefs);
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load morning stretch');
    }
  }, [workoutCustomizePrefs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const finishRun = useCallback((fromTimer = false) => {
    const startedAt = runStartedAtRef.current;
    if (!stretchPrefs || resolvedExercises.length === 0 || startedAt === null) return;
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    if (!fromTimer && !isPhaseLongEnoughToLog(startedAt)) return;
    const ratio = fromTimer ? 1 : morningStretchCompletionRatio(elapsed, stretchPrefs.durationMinutes);
    logMorningStretchCompletion(resolvedExercises, ratio);
    runStartedAtRef.current = null;
    setRunElapsedSeconds(0);
    setViewMode('summary');
    setRemainingSeconds(0);
  }, [stretchPrefs, resolvedExercises, logMorningStretchCompletion]);

  useEffect(() => {
    if (viewMode !== 'run' || !stretchPrefs) return;
    const tick = () => {
      const startedAt = runStartedAtRef.current;
      if (startedAt === null) return;
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const total = stretchPrefs.durationMinutes * 60;
      setRunElapsedSeconds(elapsed);
      const nextRemaining = Math.max(0, total - elapsed);
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0) finishRun(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [viewMode, stretchPrefs, finishRun]);

  const startRun = () => {
    if (!stretchPrefs || resolvedExercises.length === 0) return;
    runStartedAtRef.current = Date.now();
    setRunElapsedSeconds(0);
    setRemainingSeconds(stretchPrefs.durationMinutes * 60);
    setViewMode('run');
  };

  const cancelRun = () => {
    runStartedAtRef.current = null;
    setRunElapsedSeconds(0);
    setRemainingSeconds(0);
    setViewMode('summary');
  };

  if (!isTauri()) {
    return (
      <section aria-label="Morning stretch">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Sunrise className="h-5 w-5 text-amber-500" />
          Morning stretch
        </h2>
        <p className="text-sm text-muted-foreground">
          Run <code className="text-foreground">npm run tauri dev</code> for SQLite and Tauri APIs.
        </p>
      </section>
    );
  }

  if (loadError) return <p className="text-sm text-destructive">Could not load morning stretch: {loadError}</p>;
  if (!routine || !stretchPrefs) return null;
  if (!visible) return null;

  const canLogEarly = runElapsedSeconds >= 15;

  return (
    <section aria-label="Morning stretch">
      <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-orange-500/16 via-amber-500/10 to-amber-400/14 p-4 shadow-sm ring-1 ring-border/70">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sunrise className="h-5 w-5 text-orange-500" />
            Morning stretch
          </h2>
          {viewMode === 'summary' && resolvedExercises.length > 0 && (
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={startRun}>
              <Play className="h-4 w-4" />
              Start
            </Button>
          )}
          {viewMode === 'run' && (
            <Button size="sm" variant="ghost" onClick={cancelRun} aria-label="Cancel morning stretch">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {viewMode === 'summary' && (
          <>
            {routine.exerciseRefs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add moves in Settings → Morning stretch.
              </p>
            ) : (
              <ol className="space-y-2">
                {routine.exerciseRefs.map((ref, index) => (
                  <li key={`${ref.kind}:${ref.id}-${index}`} className="rounded-md border border-orange-500/15 bg-background/70 px-3 py-2 text-sm">
                    <span className="font-medium">{labelForMorningStretchRef(ref)}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        {viewMode === 'run' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-500/20 bg-background/75 p-4 shadow-inner">
              <p className="text-sm font-medium text-muted-foreground">Morning stretch block</p>
              <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{formatClock(remainingSeconds)}</p>
            </div>
            <ul className="space-y-2">
              {resolvedExercises.map((ex, index) => (
                <li key={`${ex.id}-${index}`} className="rounded-md border border-orange-500/15 bg-background/70 px-3 py-2">
                  <p className="text-sm font-medium">{ex.name}</p>
                  <p className="text-xs text-muted-foreground">{formatExerciseAmount(ex)}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => finishRun(false)} disabled={!canLogEarly}>
                Complete block
              </Button>
              <Button variant="outline" onClick={cancelRun}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
