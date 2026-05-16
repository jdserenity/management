import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ArrowRight, Clock, Dumbbell, Plus, X, Zap } from 'lucide-react';
import { useSession, type DeskPosture } from '@/context/SessionContext';
import {
  SESSION_DURATIONS_MINUTES,
  formatClock,
  formatExerciseAmount,
  formatExerciseRunAggLine,
  formatWallTime,
  type ExerciseUnit,
  type SessionType
} from '@/lib/workoutPlanner';

const Dashboard = () => {
  const {
    phase,
    breakVariant,
    longBreakStage,
    activeSessionType,
    remainingSeconds,
    nextSessionType,
    setNextSessionType,
    activeWorkout,
    workoutLogged,
    runExerciseTotals,
    runPomodoros,
    runDeepWork,
    lastSummary,
    startFlow,
    finishFlow,
    handleWorkoutCompletion,
    updateBreakExerciseAmount,
    focusDeskPosture,
    nextDeskPostureIfPomodoro,
    togglePomodoroDeskPosture
  } = useSession();

  const formatDesk = (p: DeskPosture) => (p === 'sitting' ? 'Sitting' : 'Standing');

  const timerLabel =
    phase === 'focus'
      ? activeSessionType === 'pomodoro'
        ? '🍅 Pomodoro focus'
        : '🎯 Deep work focus'
      : phase === 'break' && breakVariant === 'short'
        ? '🏃 Exercise break'
        : phase === 'break' && breakVariant === 'long' && longBreakStage === 'exercise'
          ? '🏃 Exercise break'
          : phase === 'break' && breakVariant === 'long' && longBreakStage === 'relax'
            ? '☕ Long break · relax'
            : phase === 'break' && breakVariant === 'long'
              ? '☕ Long break'
              : '🏠 Idle';

  const shortBreakMs = SESSION_DURATIONS_MINUTES.break * 60 * 1000;
  const longBreakMs = SESSION_DURATIONS_MINUTES.longBreak * 60 * 1000;
  const longBreakRelaxMinutes = SESSION_DURATIONS_MINUTES.longBreak - SESSION_DURATIONS_MINUTES.break;
  const longBreakRelaxMs = longBreakRelaxMinutes * 60 * 1000;

  const nextFocus = useMemo(() => {
    if (phase === 'idle' || !nextSessionType) return null;
    const now = Date.now();
    const remMs = remainingSeconds * 1000;
    let start: number;
    if (phase === 'focus' && activeSessionType === 'pomodoro') start = now + remMs + shortBreakMs;
    else if (phase === 'focus' && activeSessionType === 'deep') start = now + remMs + longBreakMs;
    else if (phase === 'break' && breakVariant === 'short') start = now + remMs;
    else if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'exercise') start = now + remMs + longBreakRelaxMs;
    else if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'relax') start = now + remMs;
    else if (phase === 'break' && breakVariant === 'long') start = now + remMs + longBreakRelaxMs;
    else start = now + remMs;
    const durMs = (nextSessionType === 'pomodoro' ? SESSION_DURATIONS_MINUTES.pomodoro : SESSION_DURATIONS_MINUTES.deep) * 60 * 1000;
    return { type: nextSessionType, start, end: start + durMs } as const;
  }, [phase, activeSessionType, remainingSeconds, nextSessionType, breakVariant, longBreakStage, shortBreakMs, longBreakMs, longBreakRelaxMs]);

  const showExerciseBreakPanel =
    phase === 'break' &&
    activeWorkout &&
    (breakVariant === 'short' || (breakVariant === 'long' && longBreakStage === 'exercise'));

  const showChainControls = phase === 'focus' || phase === 'break';

  const breakPreview = useMemo(() => {
    if (phase === 'idle') return null;
    if (phase === 'focus' && activeSessionType === 'pomodoro') {
      return {
        title: '🏃 Exercise break',
        detail: `${SESSION_DURATIONS_MINUTES.break} min before next focus`
      } as const;
    }
    if (phase === 'focus' && activeSessionType === 'deep') {
      return {
        title: '☕ Long break',
        detail: `${SESSION_DURATIONS_MINUTES.break} min exercise, then ${longBreakRelaxMinutes} min relax`
      } as const;
    }
    if (phase === 'break' && breakVariant === 'short') {
      return {
        title: '🏃 Exercise break',
        detail: `${SESSION_DURATIONS_MINUTES.break} min`
      } as const;
    }
    if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'exercise') {
      return {
        title: '🏃 Exercise break',
        detail: `Then ${longBreakRelaxMinutes} min to relax`
      } as const;
    }
    if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'relax') {
      return {
        title: '☕ Relax',
        detail: `${longBreakRelaxMinutes} min before next focus`
      } as const;
    }
    if (phase === 'break' && breakVariant === 'long') {
      return {
        title: '☕ Long break',
        detail: `${SESSION_DURATIONS_MINUTES.longBreak} min total`
      } as const;
    }
    return null;
  }, [phase, activeSessionType, breakVariant, longBreakStage, longBreakRelaxMinutes]);

  const unitShort = (unit: ExerciseUnit) => (unit === 'reps' ? 'reps' : unit === 'seconds' ? 'sec' : 'min');

  const exerciseLines = useMemo(
    () => Object.values(runExerciseTotals).sort((a, b) => a.label.localeCompare(b.label)),
    [runExerciseTotals]
  );

  const lastExerciseLines = useMemo(() => {
    if (!lastSummary) return [];
    return Object.values(lastSummary.exerciseTotals).sort((a, b) => a.label.localeCompare(b.label));
  }, [lastSummary]);

  const nextEmoji = (t: SessionType) => (t === 'pomodoro' ? '🍅' : '🎯');
  const nextTitle = (t: SessionType) => (t === 'pomodoro' ? 'Pomodoro' : 'Deep work');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            ✅ Work + movement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-[7] rounded-xl border bg-muted/20 p-4 shadow-inner">
              <p className="text-xl font-semibold">{timerLabel}</p>
              <p className="text-4xl font-bold mt-2 tabular-nums tracking-tight">{formatClock(remainingSeconds)}</p>
              {focusDeskPosture && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{formatDesk(focusDeskPosture)}</span>
                  {phase === 'focus' && activeSessionType === 'pomodoro' && (
                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={togglePomodoroDeskPosture} aria-label="Swap sitting and standing">
                      Swap
                    </Button>
                  )}
                  {activeSessionType === 'deep' && <span className="text-xs text-muted-foreground">· deep work</span>}
                </div>
              )}
            </div>

            <div className="hidden shrink-0 items-center justify-center px-0.5 lg:flex" aria-hidden>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex shrink-0 items-center justify-center lg:hidden" aria-hidden>
              <ArrowRight className="h-6 w-6 rotate-90 text-muted-foreground" />
            </div>

            <div className="min-w-0 flex-[1.1] lg:max-w-[11rem] lg:flex-none lg:basis-[10%]">
              {phase === 'idle' ? (
                <div className="flex h-full min-h-[5rem] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/10 px-2 py-2 text-center text-[10px] text-muted-foreground">
                  <span>Break</span>
                </div>
              ) : breakPreview ? (
                <div className="flex h-full min-h-[9.5rem] flex-col items-center justify-center gap-1 rounded-xl border bg-teal-500/10 px-2 py-3 text-center shadow-inner ring-1 ring-border/60">
                  <p className="text-[11px] font-semibold leading-tight sm:text-xs">{breakPreview.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug sm:text-[11px]">{breakPreview.detail}</p>
                </div>
              ) : null}
            </div>

            <div className="hidden shrink-0 items-center justify-center px-0.5 lg:flex" aria-hidden>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex shrink-0 items-center justify-center lg:hidden" aria-hidden>
              <ArrowRight className="h-6 w-6 rotate-90 text-muted-foreground" />
            </div>

            <div className="min-w-0 flex-[3]">
              {!showChainControls && (
                <div className="flex h-full min-h-[9.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/15 px-2 py-3 text-center text-xs text-muted-foreground">
                  <span className="text-2xl opacity-60">⏱️</span>
                  <span className="font-medium">No next focus</span>
                </div>
              )}
              {showChainControls && nextFocus && (
                <div className="flex h-full min-h-[9.5rem] flex-col rounded-xl border bg-gradient-to-br from-violet-500/12 via-background to-amber-500/10 p-3 shadow-sm ring-1 ring-border/70">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-3xl leading-none">{nextEmoji(nextFocus.type)}</div>
                      <p className="mt-1 text-sm font-semibold leading-tight">{nextTitle(nextFocus.type)}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                        <span className="font-medium text-foreground tabular-nums">{formatWallTime(nextFocus.start)}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span className="font-medium text-foreground tabular-nums">{formatWallTime(nextFocus.end)}</span>
                      </p>
                      {nextFocus.type === 'pomodoro' && nextDeskPostureIfPomodoro && (
                        <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                          <span className="font-medium text-foreground">{formatDesk(nextDeskPostureIfPomodoro)}</span>
                        </p>
                      )}
                      {nextFocus.type === 'deep' && (
                        <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                          <span className="font-medium text-foreground">Sitting</span>
                          <span className="text-muted-foreground"> · deep work</span>
                        </p>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setNextSessionType(null)} aria-label="Remove next focus session">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Separator className="my-2" />
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className={`text-lg ${nextFocus.type === 'pomodoro' ? 'opacity-100' : 'opacity-40'}`}>🍅</span>
                    <Switch
                      checked={nextFocus.type === 'deep'}
                      onCheckedChange={(checked) => setNextSessionType(checked ? 'deep' : 'pomodoro')}
                      aria-label="Toggle next focus between Pomodoro and Deep work"
                    />
                    <span className={`text-lg ${nextFocus.type === 'deep' ? 'opacity-100' : 'opacity-40'}`}>🎯</span>
                  </div>
                </div>
              )}
              {showChainControls && !nextFocus && (
                <div className="flex h-full min-h-[9.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/35 bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">Add next focus</p>
                  <Button type="button" variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setNextSessionType('pomodoro')} aria-label="Schedule next Pomodoro">
                    <Plus className="h-6 w-6" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {phase === 'idle' ? (
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => startFlow('pomodoro')}>🍅 Start Pomodoro</Button>
              <Button variant="secondary" onClick={() => startFlow('deep')}>🎯 Start deep work</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={finishFlow}>End Flow Now</Button>
            </div>
          )}

          {showExerciseBreakPanel && (
            <div className="space-y-4 rounded-lg border p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
              <p className="font-semibold text-lg flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-emerald-600" />
                🎲 {activeWorkout.name}
              </p>
              <ul className="space-y-2">
                {activeWorkout.exercises.map((ex, index) => (
                  <li key={`${activeWorkout.id}-${index}-${ex.id}`} className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{ex.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatExerciseAmount(ex)}</p>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <span className="sr-only">Adjust amount for {ex.name}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold tabular-nums text-foreground shadow-sm"
                        value={ex.amount}
                        onChange={(e) => updateBreakExerciseAmount(index, Number(e.target.value))}
                      />
                      <span className="tabular-nums">{unitShort(ex.unit)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button size="sm" onClick={handleWorkoutCompletion} disabled={workoutLogged}>
                {workoutLogged ? 'Workout Logged' : 'Complete Workout'}
              </Button>
            </div>
          )}

          {phase === 'break' && breakVariant === 'long' && longBreakStage === 'relax' && (
            <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Relax</span> — no prescribed moves. When the timer ends, your scheduled next focus starts (unless you ended the flow).
            </div>
          )}

          {(phase !== 'idle' || lastSummary) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  ⚡️ Session totals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {phase !== 'idle' && (
                  <p className="text-xs text-muted-foreground">🍅 {runPomodoros} · 🎯 {runDeepWork}</p>
                )}
                {phase !== 'idle' && (
                  <div className="space-y-2">
                    {exerciseLines.length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      exerciseLines.map((agg) => (
                        <div key={agg.id} className="rounded-md border px-3 py-2 text-sm font-medium leading-snug">
                          {formatExerciseRunAggLine(agg)}
                        </div>
                      ))
                    )}
                  </div>
                )}
                {phase !== 'idle' && lastSummary && <Separator />}
                {lastSummary && (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium">Last completed flow</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(lastSummary.startedAt).toLocaleString()} – {new Date(lastSummary.endedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">🍅 {lastSummary.pomodoros} · 🎯 {lastSummary.deepWork}</p>
                    <div className="space-y-1">
                      {lastExerciseLines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">—</p>
                      ) : (
                        lastExerciseLines.map((agg) => (
                          <div key={`last-${agg.id}`} className="text-xs">
                            {formatExerciseRunAggLine(agg)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
