import { useMemo } from 'react';
import { useSession, type DeskPosture } from '@/context/SessionContext';
import {
  SESSION_DURATIONS_MINUTES,
  formatClock,
  formatExerciseAmount,
  formatWallTime,
  type SessionType
} from '@/lib/workoutPlanner';
import { canConvertFocusSession, showSessionChainControls } from '@/lib/sessionProgress';
import { isVeryLightBreak, resolvePomodoroBreakKind, VERY_LIGHT_BREAK_HINT, VERY_LIGHT_BREAK_TITLE } from '@/lib/exerciseBreak';

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
    focusToday,
    startFlow,
    convertFlowToDeepWork,
    convertFlowToPomodoro,
    startExerciseBreak,
    finishFlow,
    handleWorkoutCompletion,
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
      : phase === 'break' && isVeryLightBreak(phase, breakVariant, longBreakStage)
        ? VERY_LIGHT_BREAK_TITLE
      : phase === 'break' && !activeSessionType
        ? '🏃 Exercise break'
      : phase === 'break' && breakVariant === 'short'
        ? activeWorkout ? '🏃 Exercise break' : '☕ Short break'
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
    else if (phase === 'break' && breakVariant === 'very_light') start = now + remMs;
    else if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'exercise') start = now + remMs + longBreakRelaxMs;
    else if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'very_light') start = now + remMs + longBreakRelaxMs;
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

  const showVeryLightBreakPanel = phase === 'break' && isVeryLightBreak(phase, breakVariant, longBreakStage);
  const isStandaloneExerciseBreak = phase === 'break' && !activeSessionType && breakVariant === 'short';
  const isStandaloneVeryLightBreak = phase === 'break' && !activeSessionType && breakVariant === 'very_light';
  const showChainControls = showSessionChainControls(phase);

  const breakPreview = useMemo(() => {
    if (phase === 'idle' || isStandaloneExerciseBreak || isStandaloneVeryLightBreak) return null;
    if (phase === 'focus' && activeSessionType === 'pomodoro') {
      const breakKind = resolvePomodoroBreakKind(runPomodoros + 1, cantExerciseMode);
      return {
        title: breakKind === 'very_light' ? VERY_LIGHT_BREAK_TITLE : breakKind === 'exercise' ? '🏃 Exercise break' : '☕ Short break',
        detail: breakKind === 'very_light'
          ? `${SESSION_DURATIONS_MINUTES.break} min · water, bathroom, or phone`
          : breakKind === 'exercise'
            ? `${SESSION_DURATIONS_MINUTES.break} min before next focus`
            : `${SESSION_DURATIONS_MINUTES.break} min · sit/stand reminder`
      } as const;
    }
    if (phase === 'focus' && activeSessionType === 'deep') {
      return {
        title: cantExerciseMode ? VERY_LIGHT_BREAK_TITLE : '☕ Long break',
        detail: cantExerciseMode
          ? `${SESSION_DURATIONS_MINUTES.break} min very light, then ${longBreakRelaxMinutes} min relax`
          : `${SESSION_DURATIONS_MINUTES.break} min exercise, then ${longBreakRelaxMinutes} min relax`
      } as const;
    }
    if (phase === 'break' && breakVariant === 'very_light') {
      return { title: VERY_LIGHT_BREAK_TITLE, detail: `${SESSION_DURATIONS_MINUTES.break} min` } as const;
    }
    if (phase === 'break' && breakVariant === 'short') {
      return { title: activeWorkout ? '🏃 Exercise break' : '☕ Short break', detail: `${SESSION_DURATIONS_MINUTES.break} min` } as const;
    }
    if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'very_light') {
      return { title: VERY_LIGHT_BREAK_TITLE, detail: `Then ${longBreakRelaxMinutes} min to relax` } as const;
    }
    if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'exercise') {
      return { title: '🏃 Exercise break', detail: `Then ${longBreakRelaxMinutes} min to relax` } as const;
    }
    if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'relax') {
      return { title: '☕ Relax', detail: `${longBreakRelaxMinutes} min before next focus` } as const;
    }
    if (phase === 'break' && breakVariant === 'long') {
      return { title: '☕ Long break', detail: `${SESSION_DURATIONS_MINUTES.longBreak} min total` } as const;
    }
    return null;
  }, [phase, activeSessionType, breakVariant, longBreakStage, longBreakRelaxMinutes, isStandaloneExerciseBreak, isStandaloneVeryLightBreak, runPomodoros, activeWorkout, cantExerciseMode]);

  const nextEmoji = (t: SessionType) => (t === 'pomodoro' ? '🍅' : '🎯');
  const nextTitle = (t: SessionType) => (t === 'pomodoro' ? 'Pomodoro' : 'Deep work');
  const showConvertToDeepWork = canConvertFocusSession(phase, activeSessionType, 'deep');
  const showConvertToPomodoro = canConvertFocusSession(phase, activeSessionType, 'pomodoro');

  return (
    <div className="plugin-page">
      <section className="plugin-panel">
        <h2 className="plugin-panel-title">✅ Work + movement</h2>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <div className="plugin-panel-flat min-w-0 flex-[7]">
            <p className="font-semibold text-[1.05em]">{timerLabel}</p>
            <p className="plugin-counts-lg mt-2">{formatClock(remainingSeconds)}</p>
            {focusDeskPosture && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{formatDesk(focusDeskPosture)}</span>
                {phase === 'focus' && activeSessionType === 'pomodoro' && (
                  <button type="button" className="plugin-btn" style={{ padding: '4px 10px', fontSize: '0.75em' }} onClick={togglePomodoroDeskPosture}>
                    Swap
                  </button>
                )}
                {showConvertToDeepWork && (
                  <button type="button" className="plugin-btn" style={{ padding: '4px 10px', fontSize: '0.75em' }} onClick={convertFlowToDeepWork}>
                    🎯 Deep work
                  </button>
                )}
                {showConvertToPomodoro && (
                  <button type="button" className="plugin-btn" style={{ padding: '4px 10px', fontSize: '0.75em' }} onClick={convertFlowToPomodoro}>
                    🍅 Pomodoro
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:contents">
            <div className="min-w-0 lg:flex-[1.1] lg:max-w-[11rem]">
              {phase === 'idle' || isStandaloneExerciseBreak || isStandaloneVeryLightBreak ? (
                <div className="plugin-panel-flat flex h-full min-h-[5.5rem] items-center justify-center plugin-muted text-xs border-dashed">
                  Break
                </div>
              ) : breakPreview ? (
                <div className="plugin-panel-flat flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-1 text-center">
                  <p className="text-xs font-semibold leading-tight">{breakPreview.title}</p>
                  <p className="plugin-muted text-[11px] leading-snug">{breakPreview.detail}</p>
                </div>
              ) : null}
            </div>

            <div className="min-w-0 lg:flex-[3]">
              {!showChainControls && (
                <div className="plugin-panel-flat flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-1 text-center border-dashed">
                  <span className="plugin-muted text-xs font-medium">No next focus</span>
                </div>
              )}
              {showChainControls && nextFocus && (
                <div className="plugin-panel-flat flex h-full min-h-[5.5rem] flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xl leading-none">{nextEmoji(nextFocus.type)}</div>
                      <p className="mt-1 text-xs font-semibold">{nextTitle(nextFocus.type)}</p>
                      <p className="mt-1 text-[11px] plugin-muted">
                        <span className="font-medium text-foreground tabular-nums">{formatWallTime(nextFocus.start)}</span>
                        {' → '}
                        <span className="font-medium text-foreground tabular-nums">{formatWallTime(nextFocus.end)}</span>
                      </p>
                      {nextFocus.type === 'pomodoro' && nextDeskPostureIfPomodoro && (
                        <p className="mt-0.5 text-[11px] font-medium">{formatDesk(nextDeskPostureIfPomodoro)}</p>
                      )}
                      {nextFocus.type === 'deep' && (
                        <p className="mt-0.5 text-[11px] plugin-muted"><span className="font-medium text-foreground">Sitting</span> · deep</p>
                      )}
                    </div>
                    <button type="button" className="plugin-btn-ghost" onClick={() => setNextSessionType(null)} aria-label="Remove next focus">×</button>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
                    <span className={nextFocus.type === 'pomodoro' ? 'opacity-100' : 'opacity-40'}>🍅</span>
                    <button
                      type="button"
                      className="plugin-btn"
                      style={{ padding: '4px 10px', fontSize: '0.75em' }}
                      onClick={() => setNextSessionType(nextFocus.type === 'deep' ? 'pomodoro' : 'deep')}
                    >
                      Toggle {nextFocus.type === 'deep' ? '🍅' : '🎯'}
                    </button>
                    <span className={nextFocus.type === 'deep' ? 'opacity-100' : 'opacity-40'}>🎯</span>
                  </div>
                </div>
              )}
              {showChainControls && !nextFocus && (
                <div className="plugin-panel-flat flex h-full min-h-[5.5rem] flex-col items-center justify-center gap-2 border-dashed">
                  <p className="plugin-muted text-xs">Add next focus</p>
                  <button type="button" className="plugin-btn" onClick={() => setNextSessionType('pomodoro')}>+</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {phase === 'idle' ? (
            <>
              <button type="button" className="plugin-btn plugin-btn-primary" onClick={() => startFlow('pomodoro')}>🍅 Start Pomodoro</button>
              <button type="button" className="plugin-btn" onClick={() => startFlow('deep')}>🎯 Start deep work</button>
              <button type="button" className="plugin-btn" onClick={startExerciseBreak}>
                {cantExerciseMode ? '🫖 Start Very Light Break' : '🏃 Start Exercise Break'}
              </button>
            </>
          ) : (
            <button type="button" className="plugin-btn" onClick={finishFlow}>End Flow Now</button>
          )}
        </div>

        {showExerciseBreakPanel && activeWorkout && (
          <div className="plugin-panel-flat mt-3 space-y-3">
            <p className="font-semibold">🎲 {activeWorkout.name}</p>
            <ul className="space-y-0">
              {activeWorkout.exercises.map((ex, index) => (
                <li key={`${activeWorkout.id}-${index}-${ex.id}`} className="plugin-row">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{ex.name}</p>
                    <p className="plugin-muted text-xs">{formatExerciseAmount(ex)}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs plugin-muted shrink-0">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="plugin-input w-16 tabular-nums font-semibold"
                      value={ex.amount}
                      onChange={(e) => updateBreakExerciseAmount(index, Number(e.target.value))}
                    />
                    <span>{ex.unit === 'reps' ? 'reps' : ex.unit === 'seconds' ? 'sec' : 'min'}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="plugin-btn plugin-btn-primary" onClick={handleWorkoutCompletion}>
              {workoutLogged ? 'Workout Logged' : 'Complete Workout'}
            </button>
          </div>
        )}

        {showVeryLightBreakPanel && (
          <div className="plugin-panel-flat mt-3 border-dashed">
            <p className="font-semibold">{VERY_LIGHT_BREAK_TITLE}</p>
            <p className="plugin-muted mt-1">{VERY_LIGHT_BREAK_HINT}</p>
          </div>
        )}

        {phase === 'break' && breakVariant === 'long' && longBreakStage === 'relax' && (
          <div className="plugin-panel-flat mt-3 border-dashed plugin-muted text-sm">
            <span className="font-medium text-foreground">Relax</span> — no prescribed moves. When the timer ends, your scheduled next focus starts.
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] plugin-muted">
            <input
              type="checkbox"
              checked={cantExerciseMode}
              onChange={(e) => setCantExerciseMode(e.target.checked)}
              aria-label="Can't exercise right now"
            />
            <span>Can&apos;t exercise rn</span>
          </label>
        </div>
      </section>

      <section className="plugin-panel">
        <h2 className="plugin-panel-title">Today&apos;s work</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="plugin-stat-block">
            <p className="font-medium text-sm">🍅 Pomodoros</p>
            <p className="plugin-counts">{focusToday.todayPomodoros}</p>
          </div>
          <div className="plugin-stat-block">
            <p className="font-medium text-sm">🎯 Deep work</p>
            <p className="plugin-counts">{focusToday.todayDeepWork}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
