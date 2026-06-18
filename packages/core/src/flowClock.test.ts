import { describe, expect, it } from 'vitest';
import { flowRemainingSecondsLive, phaseEndsAtFromFlow, remainingSecondsFromEndsAt } from './flowClock';
import type { PersistedFlowState } from './flowState';

const sampleBreak = (): PersistedFlowState => ({
  version: 1,
  phase: 'break',
  breakVariant: 'short',
  longBreakStage: null,
  activeSessionType: null,
  remainingSeconds: 120,
  phasePlannedSeconds: 300,
  phaseStartedAtMs: 1_000_000,
  nextSessionType: 'pomodoro',
  activeWorkout: null,
  workoutLogged: false,
  runStartedAt: null,
  runPomodoros: 0,
  runDeepWork: 0,
  runExerciseTotals: {},
  pomodoroPosture: 'sitting',
  lastPomodoroPosture: null
});

describe('flowClock', () => {
  it('counts down from phaseEndsAtMs', () => {
    expect(remainingSecondsFromEndsAt(10_000, 4_000)).toBe(6);
    expect(remainingSecondsFromEndsAt(10_000, 10_500)).toBe(0);
  });

  it('derives phaseEndsAt from a persisted snapshot', () => {
    const flow = sampleBreak();
    expect(phaseEndsAtFromFlow(flow, 5_000)).toBe(5_000 + 120_000);
  });

  it('returns live remaining for active phases only', () => {
    const flow = sampleBreak();
    const endsAt = phaseEndsAtFromFlow(flow, 1_000);
    expect(flowRemainingSecondsLive(flow, endsAt, 31_000)).toBe(90);
    expect(flowRemainingSecondsLive({ ...flow, phase: 'idle' }, endsAt, 31_000)).toBe(0);
  });
});
