// src/components/daily/MorningStretchSection.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/context/SessionContext';
import MorningStretchRoutineEditor from '@/components/daily/MorningStretchRoutineEditor';
import { isTauri } from '@/lib/isTauri';
import {
  isMorningStretchCompletedToday,
  listMorningStretchCatalog,
  morningStretchCompletionRatio,
  resolveMorningStretchExercises,
  shouldShowMorningStretchSection,
  type MorningStretchRef,
  type MorningStretchRoutine
} from '@/lib/morningStretch/morningStretch';
import { loadMorningStretchRoutine, saveMorningStretchRoutine } from '@/lib/morningStretch/morningStretchDb';
import { loadMorningStretchPrefs, type MorningStretchPrefs } from '@/lib/morningStretch/morningStretchPref';
import { isPhaseLongEnoughToLog } from '@/lib/sessionProgress';
import { formatClock, formatExerciseAmount } from '@/lib/workoutPlanner';
import { Pencil, Play, Sunrise, X } from 'lucide-react';

type ViewMode = 'summary' | 'edit' | 'run';

const refKey = (ref: MorningStretchRef): string => `${ref.kind}:${ref.id}`;

export default function MorningStretchSection() {
  const { workoutCustomizePrefs, workoutLogs, dayRolloverHour, logMorningStretchCompletion } = useSession();
  const [routine, setRoutine] = useState<MorningStretchRoutine | null>(null);
  const [stretchPrefs, setStretchPrefs] = useState<MorningStretchPrefs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [saving, setSaving] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [runElapsedSeconds, setRunElapsedSeconds] = useState(0);
  const runStartedAtRef = useRef<number | null>(null);

  const catalog = useMemo(() => listMorningStretchCatalog(workoutCustomizePrefs), [workoutCustomizePrefs]);
  const catalogByKey = useMemo(() => new Map(catalog.map((row) => [refKey(row.ref), row])), [catalog]);
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

  const persistRoutine = async (next: MorningStretchRoutine) => {
    setSaving(true);
    try {
      await saveMorningStretchRoutine(next);
      setRoutine(next);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const addRef = (ref: MorningStretchRef) => {
    if (!routine) return;
    if (routine.exerciseRefs.some((r) => refKey(r) === refKey(ref))) return;
    void persistRoutine({ exerciseRefs: [...routine.exerciseRefs, ref] });
  };

  const removeAt = (index: number) => {
    if (!routine) return;
    void persistRoutine({ exerciseRefs: routine.exerciseRefs.filter((_, i) => i !== index) });
  };

  const moveRef = (index: number, dir: -1 | 1) => {
    if (!routine) return;
    const next = [...routine.exerciseRefs];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void persistRoutine({ exerciseRefs: next });
  };

  const labelForRef = (ref: MorningStretchRef): string => catalogByKey.get(refKey(ref))?.label ?? ref.id;

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

  const availableToAdd = catalog.filter((row) => !routine.exerciseRefs.some((r) => refKey(r) === refKey(row.ref)));
  const canLogEarly = runElapsedSeconds >= 15;

  return (
    <section aria-label="Morning stretch">
      <div className="overflow-hidden rounded-xl border bg-gradient-to-br from-orange-500/16 via-background to-amber-400/14 p-4 shadow-sm ring-1 ring-orange-500/20">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sunrise className="h-5 w-5 text-orange-500" />
            Morning stretch
          </h2>
          {viewMode === 'summary' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="bg-background/70" onClick={() => setViewMode('edit')} aria-label="Edit morning stretch routine">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              {resolvedExercises.length > 0 && (
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={startRun}>
                  <Play className="h-4 w-4" />
                  Start {stretchPrefs.durationMinutes} min
                </Button>
              )}
            </div>
          )}
          {viewMode !== 'summary' && (
            <Button size="sm" variant="ghost" className="bg-background/60" onClick={() => (viewMode === 'run' ? cancelRun() : setViewMode('summary'))} aria-label="Close morning stretch">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {viewMode === 'summary' && (
          <>
            {routine.exerciseRefs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Build a wake-up routine from your enabled exercises. Add moves in Customize workouts first if the pool is empty.
              </p>
            ) : (
              <ol className="space-y-2">
                {routine.exerciseRefs.map((ref, index) => (
                  <li key={`${refKey(ref)}-${index}`} className="rounded-md border border-orange-500/15 bg-background/70 px-3 py-2 text-sm">
                    <span className="font-medium">{labelForRef(ref)}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        {viewMode === 'edit' && (
          <MorningStretchRoutineEditor
            routine={routine}
            availableToAdd={availableToAdd}
            saving={saving}
            labelForRef={labelForRef}
            onAdd={addRef}
            onRemove={removeAt}
            onMove={moveRef}
          />
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
              <Button variant="outline" className="bg-background/70" onClick={cancelRun}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
