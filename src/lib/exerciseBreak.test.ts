import { describe, expect, it } from 'vitest';
import type { PersistedFlowState } from '@/lib/flowState';
import {
  isVeryLightBreak,
  normalizeFlowForCantExerciseMode,
  POMODORO_EXERCISE_BREAK_INTERVAL,
  resolveLongBreakExerciseStage,
  resolvePomodoroBreakKind,
  restoreExerciseBreakFromVeryLight,
  shouldScheduleExerciseOnPomodoroBreak,
  VERY_LIGHT_BREAK_HINT,
  VERY_LIGHT_BREAK_TITLE
} from '@/lib/exerciseBreak';

const baseFlow = (): PersistedFlowState => ({
  version: 1,
  phase: 'break',
  breakVariant: 'short',
  longBreakStage: null,
  activeSessionType: 'pomodoro',
  remainingSeconds: 300,
  phasePlannedSeconds: 300,
  phaseStartedAtMs: 1,
  nextSessionType: 'pomodoro',
  activeWorkout: { id: 'mixed-break', name: 'Mixed', estimatedMinutes: 2, exercises: [{ id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }] },
  workoutLogged: false,
  runStartedAt: 1,
  runPomodoros: 2,
  runDeepWork: 0,
  runExerciseTotals: {},
  pomodoroPosture: 'sitting',
  lastPomodoroPosture: 'sitting'
});

describe('shouldScheduleExerciseOnPomodoroBreak', () => {
  it('schedules exercise every two pomodoros by default', () => {
    expect(POMODORO_EXERCISE_BREAK_INTERVAL).toBe(2);
    expect(shouldScheduleExerciseOnPomodoroBreak(1)).toBe(false);
    expect(shouldScheduleExerciseOnPomodoroBreak(2)).toBe(true);
    expect(shouldScheduleExerciseOnPomodoroBreak(3)).toBe(false);
    expect(shouldScheduleExerciseOnPomodoroBreak(4)).toBe(true);
  });
});

describe('resolvePomodoroBreakKind', () => {
  it('uses relax, exercise, or very light depending on cadence and cant-exercise mode', () => {
    expect(resolvePomodoroBreakKind(1, false)).toBe('relax');
    expect(resolvePomodoroBreakKind(2, false)).toBe('exercise');
    expect(resolvePomodoroBreakKind(2, true)).toBe('very_light');
    expect(resolvePomodoroBreakKind(3, true)).toBe('relax');
  });

  it('schedules exercise after a resumed flow when one pomodoro was already completed today', () => {
    const completedInChain = 1;
    expect(resolvePomodoroBreakKind(completedInChain + 1, false)).toBe('exercise');
    expect(resolvePomodoroBreakKind(completedInChain + 1, true)).toBe('very_light');
  });
});

describe('resolveLongBreakExerciseStage', () => {
  it('maps deep-work exercise stage to very light when cant-exercise mode is on', () => {
    expect(resolveLongBreakExerciseStage(false)).toBe('exercise');
    expect(resolveLongBreakExerciseStage(true)).toBe('very_light');
  });
});

describe('isVeryLightBreak', () => {
  it('detects pomodoro and deep-work very light phases', () => {
    expect(isVeryLightBreak('break', 'very_light', null)).toBe(true);
    expect(isVeryLightBreak('break', 'long', 'very_light')).toBe(true);
    expect(isVeryLightBreak('break', 'short', null)).toBe(false);
    expect(isVeryLightBreak('focus', 'very_light', null)).toBe(false);
  });
});

describe('normalizeFlowForCantExerciseMode', () => {
  it('converts an in-progress exercise break to very light with no workout', () => {
    const normalized = normalizeFlowForCantExerciseMode(baseFlow(), true);
    expect(normalized.breakVariant).toBe('very_light');
    expect(normalized.activeWorkout).toBeNull();
    expect(normalized.workoutLogged).toBe(false);
  });

  it('converts long-break exercise stage to very light', () => {
    const flow = { ...baseFlow(), breakVariant: 'long' as const, longBreakStage: 'exercise' as const, activeSessionType: 'deep' as const };
    const normalized = normalizeFlowForCantExerciseMode(flow, true);
    expect(normalized.longBreakStage).toBe('very_light');
    expect(normalized.activeWorkout).toBeNull();
  });

  it('leaves relax breaks unchanged', () => {
    const flow = { ...baseFlow(), activeWorkout: null };
    expect(normalizeFlowForCantExerciseMode(flow, true)).toEqual(flow);
  });
});

describe('restoreExerciseBreakFromVeryLight', () => {
  it('restores pomodoro and deep very light breaks to exercise stages', () => {
    expect(restoreExerciseBreakFromVeryLight({ ...baseFlow(), breakVariant: 'very_light', activeWorkout: null })).toEqual({
      breakVariant: 'short',
      longBreakStage: null
    });
    expect(
      restoreExerciseBreakFromVeryLight({ ...baseFlow(), breakVariant: 'long', longBreakStage: 'very_light', activeWorkout: null })
    ).toEqual({ breakVariant: 'long', longBreakStage: 'exercise' });
  });
});

describe('very light break copy', () => {
  it('exposes a user-facing title and hint', () => {
    expect(VERY_LIGHT_BREAK_TITLE).toContain('Very Light Break');
    expect(VERY_LIGHT_BREAK_HINT.length).toBeGreaterThan(20);
  });
});
