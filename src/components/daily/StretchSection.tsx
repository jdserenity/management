// src/components/daily/StretchSection.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/context/SessionContext';
import {
  isStretchCompletedToday,
  resolveMorningStretchExercises,
  shouldShowStretchSection,
  stretchCompletionRatio,
  STRETCH_GRADIENT_STYLES,
  type StretchDefinition
} from '@/lib/stretchCreator/stretchCreator';
import { formatClock, formatExerciseAmount } from '@/lib/workoutPlanner';
import { Play } from 'lucide-react';

type ViewMode = 'summary' | 'run';

type StretchSectionProps = {
  stretch: StretchDefinition;
};

export default function StretchSection({ stretch }: StretchSectionProps) {
  const { workoutCustomizePrefs, workoutLogs, dayRolloverHour, logStretchCompletion } = useSession();
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const runStartedAtRef = useRef<number | null>(null);
  const runActiveRef = useRef(false);
  const timerIntervalRef = useRef<number | null>(null);
  const style = STRETCH_GRADIENT_STYLES[stretch.gradientId];

  const clearRunTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const resolvedExercises = useMemo(
    () => resolveMorningStretchExercises({ exerciseRefs: stretch.exerciseRefs }, workoutCustomizePrefs),
    [stretch.exerciseRefs, workoutCustomizePrefs]
  );
  const doneToday = useMemo(
    () => isStretchCompletedToday(stretch, workoutLogs, nowMs, dayRolloverHour),
    [stretch, workoutLogs, dayRolloverHour, nowMs]
  );
  const activeRun = viewMode === 'run';
  const visible = shouldShowStretchSection({ stretch, completedToday: doneToday, nowTimestamp: nowMs, activeRun });

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const finishRun = useCallback((fromTimer = false) => {
    if (!runActiveRef.current) return;
    const startedAt = runStartedAtRef.current;
    if (resolvedExercises.length === 0 || startedAt === null) return;
    runActiveRef.current = false;
    clearRunTimer();
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const ratio = fromTimer ? 1 : stretchCompletionRatio(elapsed, stretch.durationMinutes);
    logStretchCompletion(stretch, resolvedExercises, ratio);
    runStartedAtRef.current = null;
    setViewMode('summary');
    setRemainingSeconds(0);
  }, [stretch, resolvedExercises, logStretchCompletion, clearRunTimer]);

  useEffect(() => {
    if (viewMode !== 'run') return;
    const tick = () => {
      if (!runActiveRef.current) return;
      const startedAt = runStartedAtRef.current;
      if (startedAt === null) return;
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const total = stretch.durationMinutes * 60;
      const nextRemaining = Math.max(0, total - elapsed);
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0) finishRun(true);
    };
    tick();
    timerIntervalRef.current = window.setInterval(tick, 1000);
    return () => clearRunTimer();
  }, [viewMode, stretch.durationMinutes, finishRun, clearRunTimer]);

  const startRun = () => {
    if (resolvedExercises.length === 0) return;
    clearRunTimer();
    runActiveRef.current = true;
    runStartedAtRef.current = Date.now();
    setRemainingSeconds(stretch.durationMinutes * 60);
    setViewMode('run');
  };

  const cancelRun = () => {
    runActiveRef.current = false;
    clearRunTimer();
    runStartedAtRef.current = null;
    setRemainingSeconds(0);
    setViewMode('summary');
  };

  if (!visible) return null;

  return (
    <section aria-label={stretch.name}>
      <div className={`overflow-hidden rounded-xl border p-4 shadow-sm ring-1 ${style.cardClass} ${style.ringClass}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <span className={style.iconClass} aria-hidden>{stretch.emoji}</span>
            {stretch.name}
            {stretch.builtIn && <span className="text-xs font-normal text-muted-foreground">(built-in)</span>}
          </h2>
          {viewMode === 'summary' && resolvedExercises.length > 0 && (
            <Button size="sm" className={style.buttonClass} onClick={startRun}>
              <Play className="h-4 w-4" />
              Start
            </Button>
          )}
        </div>

        {viewMode === 'summary' && (
          <div className="flex flex-col justify-center py-2">
            {stretch.exerciseRefs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add moves in Customize → Stretches.</p>
            ) : (
              <p className="pl-3 text-sm leading-relaxed text-foreground/65">
                {stretch.exerciseRefs.length} move{stretch.exerciseRefs.length === 1 ? '' : 's'} · ~{stretch.durationMinutes} min
              </p>
            )}
          </div>
        )}

        {viewMode === 'run' && (
          <div className="space-y-4">
            <div className={`rounded-xl border bg-background/75 p-4 shadow-inner ${style.borderClass}`}>
              <p className="text-sm font-medium text-muted-foreground">{stretch.name} block</p>
              <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{formatClock(remainingSeconds)}</p>
            </div>
            <ul className="space-y-2">
              {resolvedExercises.map((ex, index) => (
                <li key={`${ex.id}-${index}`} className={`rounded-md border bg-background/70 px-3 py-2 ${style.borderClass}`}>
                  <p className="text-sm font-medium">{ex.name}</p>
                  <p className="text-xs text-muted-foreground">{formatExerciseAmount(ex)}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => finishRun(false)}>Complete block</Button>
              <Button variant="outline" onClick={cancelRun}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
