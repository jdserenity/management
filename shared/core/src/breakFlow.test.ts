import { describe, expect, it } from 'vitest';
import { advanceBreakAfterExerciseComplete, advanceBreakWhenTimerEnds, isActiveExerciseBreak } from './breakFlow';
import type { PersistedFlowState } from './flowState';

const baseFlow = (): PersistedFlowState => ({
  version: 1,
  phase: 'break',
  breakVariant: 'short',
  longBreakStage: null,
  activeSessionType: 'pomodoro',
  remainingSeconds: 0,
  phasePlannedSeconds: 300,
  phaseStartedAtMs: 1,
  nextSessionType: 'pomodoro',
  activeWorkout: { id: 'w', name: 'Break', estimatedMinutes: 5, exercises: [] },
  workoutLogged: false,
  runStartedAt: 1,
  runPomodoros: 1,
  runDeepWork: 0,
  runExerciseTotals: {},
  pomodoroPosture: 'sitting',
  lastPomodoroPosture: 'sitting'
});

describe('breakFlow', () => {
  it('detects active exercise break phases', () => {
    expect(isActiveExerciseBreak('break', 'short', null, baseFlow().activeWorkout)).toBe(true);
    expect(isActiveExerciseBreak('break', 'long', 'relax', baseFlow().activeWorkout)).toBe(false);
    expect(isActiveExerciseBreak('focus', 'short', null, baseFlow().activeWorkout)).toBe(false);
  });

  it('advances short break to next focus when scheduled', () => {
    const result = advanceBreakWhenTimerEnds(baseFlow(), 1000);
    expect(result.kind).toBe('start_focus');
    if (result.kind === 'start_focus') {
      expect(result.flow.phase).toBe('focus');
      expect(result.flow.activeSessionType).toBe('pomodoro');
    }
  });

  it('finishes standalone short break when no next session', () => {
    const result = advanceBreakWhenTimerEnds({ ...baseFlow(), nextSessionType: null }, 1000);
    expect(result.kind).toBe('finish');
  });

  it('advances long break exercise to relax before next focus', () => {
    const flow = { ...baseFlow(), breakVariant: 'long' as const, longBreakStage: 'exercise' as const, activeSessionType: 'deep' as const, nextSessionType: 'pomodoro' as const };
    const result = advanceBreakWhenTimerEnds(flow, 1000);
    expect(result.kind).toBe('long_relax');
    if (result.kind === 'long_relax') {
      expect(result.flow.longBreakStage).toBe('relax');
      expect(result.flow.activeWorkout).toBeNull();
    }
  });

  it('advances long break very light to relax before next focus', () => {
    const flow = { ...baseFlow(), breakVariant: 'long' as const, longBreakStage: 'very_light' as const, activeSessionType: 'deep' as const, nextSessionType: 'pomodoro' as const, activeWorkout: null };
    const result = advanceBreakWhenTimerEnds(flow, 1000);
    expect(result.kind).toBe('long_relax');
  });

  it('complete workout uses the same advance rules as timer end', () => {
    const result = advanceBreakAfterExerciseComplete({ ...baseFlow(), nextSessionType: null }, 1000);
    expect(result.kind).toBe('finish');
  });
});
