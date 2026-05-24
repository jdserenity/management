import { describe, expect, it } from 'vitest';
import {
  computeCompletionRatio,
  creditFocusMinutes,
  isPhaseLongEnoughToLog,
  MIN_PHASE_LOG_SECONDS,
  phaseElapsedSeconds,
  scaleExercisesByRatio
} from '@/lib/sessionProgress';

describe('isPhaseLongEnoughToLog', () => {
  it('rejects phases under 15 seconds', () => {
    const start = 1_000_000;
    expect(isPhaseLongEnoughToLog(start, MIN_PHASE_LOG_SECONDS, start + 14_999)).toBe(false);
    expect(isPhaseLongEnoughToLog(start, MIN_PHASE_LOG_SECONDS, start + 15_000)).toBe(true);
  });

  it('measures elapsed whole seconds', () => {
    expect(phaseElapsedSeconds(1000, 11499)).toBe(10);
  });
});

describe('computeCompletionRatio', () => {
  it('returns 1 when timer finished', () => {
    expect(computeCompletionRatio(1500, 0)).toBe(1);
  });

  it('returns partial when time remains', () => {
    expect(computeCompletionRatio(1500, 750)).toBe(0.5);
  });
});

describe('creditFocusMinutes', () => {
  it('credits proportional minutes with a minimum of 1 when any progress', () => {
    expect(creditFocusMinutes(25, 0.5)).toBe(13);
    expect(creditFocusMinutes(25, 0.02)).toBe(1);
    expect(creditFocusMinutes(25, 0)).toBe(0);
  });
});

describe('scaleExercisesByRatio', () => {
  it('scales rep counts', () => {
    const scaled = scaleExercisesByRatio(
      [{ id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }],
      0.5
    );
    expect(scaled[0]?.amount).toBe(5);
  });
});
