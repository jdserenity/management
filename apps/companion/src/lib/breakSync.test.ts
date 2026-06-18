import { describe, expect, it } from 'vitest';
import type { PersistedFlowState } from '@mgmt/core';
import { resolveBreakTimerEnd, shouldAttemptBreakAdvance, shouldSkipBreakAdvanceForDoc } from './breakSync';

const breakFlow = (nextSessionType: 'pomodoro' | null = null): PersistedFlowState => ({
  version: 1,
  phase: 'break',
  breakVariant: 'short',
  longBreakStage: null,
  activeSessionType: null,
  remainingSeconds: 0,
  phasePlannedSeconds: 300,
  phaseStartedAtMs: 1,
  nextSessionType,
  activeWorkout: { id: 'w', name: 'Break', estimatedMinutes: 5, exercises: [] },
  workoutLogged: false,
  runStartedAt: 1,
  runPomodoros: 0,
  runDeepWork: 0,
  runExerciseTotals: {},
  pomodoroPosture: 'sitting',
  lastPomodoroPosture: null
});

describe('breakSync', () => {
  it('clears standalone break when timer ends', () => {
    expect(resolveBreakTimerEnd(breakFlow(null))).toEqual({ kind: 'clear' });
  });

  it('advances chained break into next focus', () => {
    const result = resolveBreakTimerEnd(breakFlow('pomodoro'), 1000);
    expect(result.kind).toBe('advance');
    if (result.kind === 'advance') expect(result.flow.phase).toBe('focus');
  });

  it('attempts advance only when leader break is at zero', () => {
    expect(shouldAttemptBreakAdvance(true, 'break', 0)).toBe(true);
    expect(shouldAttemptBreakAdvance(true, 'break', 30)).toBe(false);
    expect(shouldAttemptBreakAdvance(false, 'break', 0)).toBe(false);
  });

  it('dedupes advance per published doc version', () => {
    expect(shouldSkipBreakAdvanceForDoc(100, 100)).toBe(true);
    expect(shouldSkipBreakAdvanceForDoc(99, 100)).toBe(true);
    expect(shouldSkipBreakAdvanceForDoc(101, 100)).toBe(false);
  });
});
