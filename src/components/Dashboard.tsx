import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ArrowRight, Briefcase, Clock, Dumbbell, Plus, X } from 'lucide-react';
import { useSession, type DeskPosture } from '@/context/SessionContext';
import {
  DASHBOARD_MANUAL_EXERCISES,
  DASHBOARD_TODAY_STRETCH_ROWS,
  SESSION_DURATIONS_MINUTES,
  formatClock,
  formatExerciseAmount,
  formatExerciseRunAggLine,
  formatTimedSecondsTotal,
  formatWallTime,
  type ExerciseUnit,
  type SessionType
} from '@/lib/workoutPlanner';
import { canConvertFocusSession, showSessionChainControls } from '@/lib/sessionProgress';
import { shouldScheduleExerciseOnPomodoroBreak } from '@/lib/exerciseBreak';

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
    todayExerciseTotals,
    todayStretchTotals,
    focusToday,
    startFlow,
    convertFlowToDeepWork,
    convertFlowToPomodoro,
    startExerciseBreak,
    finishFlow,
    handleWorkoutCompletion,
    addManualExercise,
    updateBreakExerciseAmount,
    focusDeskPosture,
    nextDeskPostureIfPomodoro,
    togglePomodoroDeskPosture,
    runPomodoros,
    cantExerciseMode,
    setCantExerciseMode
  } = useSession();

  const formatDesk = (p: DeskPosture) => (p === 'sitting' ? 'Sitting' : 'Standing');

  const timerLabel =
    phase === 'focus'
      ? activeSessionType === 'pomodoro'
        ? '🍅 Pomodoro focus'
        : '🎯 Deep work focus'
      : phase === 'break' && !activeSessionType
        ? '🏃 Exercise break'
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

  const isStandaloneExerciseBreak = phase === 'break' && !activeSessionType;
  const showChainControls = showSessionChainControls(phase);

  const breakPreview = useMemo(() => {
    if (phase === 'idle' || isStandaloneExerciseBreak) return null;
    if (phase === 'focus' && activeSessionType === 'pomodoro') {
      const willExercise = shouldScheduleExerciseOnPomodoroBreak(runPomodoros + 1);
      return {
        title: willExercise ? '🏃 Exercise break' : '☕ Short break',
        detail: willExercise
          ? `${SESSION_DURATIONS_MINUTES.break} min before next focus`
          : `${SESSION_DURATIONS_MINUTES.break} min · sit/stand reminder`
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
        title: activeWorkout ? '🏃 Exercise break' : '☕ Short break',
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
  }, [phase, activeSessionType, breakVariant, longBreakStage, longBreakRelaxMinutes, isStandaloneExerciseBreak, runPomodoros, activeWorkout]);

  const unitShort = (unit: ExerciseUnit) => (unit === 'reps' ? 'reps' : unit === 'seconds' ? 'sec' : 'min');

  const manualIncrementLabel = (unit: ExerciseUnit, amount: number) => {
    if (unit === 'reps') return `+${amount}`;
    if (unit === 'seconds') return `+${amount}s`;
    return `+${amount}m`;
  };

  const todayRowDisplay = (id: string, name: string) => {
    const agg = todayExerciseTotals[id];
    if (!agg || (agg.reps <= 0 && agg.timedSeconds <= 0)) return `${name}: 0`;
    return formatExerciseRunAggLine({ ...agg, label: name });
  };

  const todayStretchDisplay = (region: 'upper' | 'lower', label: string) => {
    const seconds = region === 'upper' ? todayStretchTotals.upperBodySeconds : todayStretchTotals.lowerBodySeconds;
    return `${label}: ${formatTimedSecondsTotal(seconds)}`;
  };

  const nextEmoji = (t: SessionType) => (t === 'pomodoro' ? '🍅' : '🎯');
  const nextTitle = (t: SessionType) => (t === 'pomodoro' ? 'Pomodoro' : 'Deep work');

  const showConvertToDeepWork = canConvertFocusSession(phase, activeSessionType, 'deep');
  const showConvertToPomodoro = canConvertFocusSession(phase, activeSessionType, 'pomodoro');

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <Switch
            checked={cantExerciseMode}
            onCheckedChange={setCantExerciseMode}
            className="scale-75"
            aria-label="Can't exercise right now"
          />
          <span>Can&apos;t exercise rn</span>
        </label>
      </div>
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
                  {showConvertToDeepWork && (
                    <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={convertFlowToDeepWork} aria-label="Switch this focus block to deep work">
                      🎯 Deep work
                    </Button>
                  )}
                  {showConvertToPomodoro && (
                    <Button type="button" variant="secondary" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={convertFlowToPomodoro} aria-label="Switch this focus block to pomodoro">
                      🍅 Pomodoro
                    </Button>
                  )}
                  {activeSessionType === 'deep' && !showConvertToPomodoro && <span className="text-xs text-muted-foreground">· deep work</span>}
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
              {phase === 'idle' || isStandaloneExerciseBreak ? (
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
              <Button variant="outline" onClick={startExerciseBreak}>🏃 Start Exercise Break</Button>
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

        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-violet-600" />
              Today&apos;s work
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center space-y-3">
            <div className="rounded-md border px-3 py-3 text-sm">
              <p className="font-medium">🍅 Pomodoros</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{focusToday.todayPomodoros}</p>
            </div>
            <div className="rounded-md border px-3 py-3 text-sm">
              <p className="font-medium">🎯 Deep work</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{focusToday.todayDeepWork}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-emerald-600" />
              Today&apos;s movement
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col space-y-2">
            {DASHBOARD_MANUAL_EXERCISES.map((ex) => (
              <div key={ex.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-medium leading-snug">{todayRowDisplay(ex.id, ex.name)}</span>
                <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 tabular-nums" onClick={() => addManualExercise(ex)} aria-label={`Add ${ex.amount} ${ex.unit} for ${ex.name}`}>
                  {manualIncrementLabel(ex.unit, ex.amount)}
                </Button>
              </div>
            ))}
            {DASHBOARD_TODAY_STRETCH_ROWS.map((row) => (
              <div key={row.region} className="rounded-md border px-3 py-2 text-sm">
                <span className="font-medium leading-snug">{todayStretchDisplay(row.region, row.label)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
