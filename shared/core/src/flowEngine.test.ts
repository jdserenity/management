import { describe, expect, it } from 'vitest';
import {
  convertFocusFlow,
  idleFlow,
  onFocusTimerEnd,
  startExerciseBreakFlow,
  startFocusFlow
} from './flowEngine';
import { SESSION_DURATIONS_MINUTES } from './sessionProgress';

describe('flowEngine', () => {
  it('starts pomodoro focus at full duration and preserves chain count', () => {
    const { flow, phaseEndsAtMs } = startFocusFlow('pomodoro', 10_000, { runPomodoros: 3 });
    expect(flow.phase).toBe('focus');
    expect(flow.activeSessionType).toBe('pomodoro');
    expect(flow.runPomodoros).toBe(3);
    expect(flow.remainingSeconds).toBe(SESSION_DURATIONS_MINUTES.pomodoro * 60);
    expect(phaseEndsAtMs).toBe(10_000 + flow.remainingSeconds * 1000);
  });

  it('starts very light exercise break without workout', () => {
    const { flow } = startExerciseBreakFlow(true, { id: 'w', name: 'W', estimatedMinutes: 1, exercises: [] }, 1);
    expect(flow.phase).toBe('break');
    expect(flow.breakVariant).toBe('very_light');
    expect(flow.activeWorkout).toBeNull();
  });

  it('converts focus deep→pomodoro with remaining clamp', () => {
    const started = startFocusFlow('deep', 0);
    const mid = { ...started.flow, remainingSeconds: SESSION_DURATIONS_MINUTES.deep * 60 - 100 };
    const result = convertFocusFlow(mid, 'pomodoro', 5000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.priorSessionType).toBe('deep');
      expect(result.flow.activeSessionType).toBe('pomodoro');
      expect(result.flow.remainingSeconds).toBeLessThanOrEqual(SESSION_DURATIONS_MINUTES.pomodoro * 60);
    }
  });

  it('ends pomodoro focus into exercise break', () => {
    const started = startFocusFlow('pomodoro', 0);
    const workout = { id: 'w', name: 'Break', estimatedMinutes: 5, exercises: [] };
    const { flow } = onFocusTimerEnd(started.flow, { breakKind: 'exercise', longStage: 'exercise', workout, nowMs: 100 });
    expect(flow.phase).toBe('break');
    expect(flow.breakVariant).toBe('short');
    expect(flow.activeWorkout).toEqual(workout);
    expect(flow.lastPomodoroPosture).toBe('sitting');
  });

  it('ends deep focus into long exercise stage', () => {
    const started = startFocusFlow('deep', 0);
    const workout = { id: 'w', name: 'Break', estimatedMinutes: 5, exercises: [] };
    const { flow } = onFocusTimerEnd(started.flow, { breakKind: 'relax', longStage: 'exercise', workout, nowMs: 100 });
    expect(flow.breakVariant).toBe('long');
    expect(flow.longBreakStage).toBe('exercise');
    expect(flow.activeWorkout).toEqual(workout);
  });

  it('idleFlow is idle with zero timer', () => {
    expect(idleFlow().phase).toBe('idle');
    expect(idleFlow().remainingSeconds).toBe(0);
  });
});
