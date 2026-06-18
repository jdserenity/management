import { describe, expect, it } from 'vitest';
import {
  breakTimerEndAction,
  canConvertFocusSession,
  computeCompletionRatio,
  creditFocusMinutes,
  focusElapsedSeconds,
  isPhaseLongEnoughToLog,
  MIN_PHASE_LOG_SECONDS,
  phaseElapsedSeconds,
  remainingSecondsWhenConvertingToDeep,
  remainingSecondsWhenConvertingToPomodoro,
  scaleExercisesByRatio,
  showSessionChainControls
} from './sessionProgress';

describe('sessionProgress', () => {
  it('shows next-focus controls during focus or break', () => {
    expect(showSessionChainControls('break')).toBe(true);
    expect(showSessionChainControls('focus')).toBe(true);
    expect(showSessionChainControls('idle')).toBe(false);
  });

  it('finishes standalone short break when no next session', () => {
    expect(breakTimerEndAction('short', null, 'pomodoro')).toBe('start_focus');
    expect(breakTimerEndAction('short', null, null)).toBe('finish');
  });

  it('advances long break exercise to relax before next focus', () => {
    expect(breakTimerEndAction('long', 'exercise', 'pomodoro')).toBe('long_relax');
    expect(breakTimerEndAction('long', 'relax', 'pomodoro')).toBe('start_focus');
  });

  it('tracks phase elapsed and logging threshold', () => {
    const start = 1_000_000;
    expect(phaseElapsedSeconds(start, start + 14_999)).toBe(14);
    expect(isPhaseLongEnoughToLog(start, MIN_PHASE_LOG_SECONDS, start + 15_000)).toBe(true);
    expect(isPhaseLongEnoughToLog(start, MIN_PHASE_LOG_SECONDS, start + 14_000)).toBe(false);
  });

  it('converts focus sessions only during focus phase', () => {
    expect(canConvertFocusSession('focus', 'pomodoro', 'deep')).toBe(true);
    expect(canConvertFocusSession('break', 'pomodoro', 'deep')).toBe(false);
  });

  it('computes focus elapsed and conversion remainders', () => {
    expect(focusElapsedSeconds(1500, 900)).toBe(600);
    expect(remainingSecondsWhenConvertingToDeep(600)).toBe(90 * 60 - 600);
    expect(remainingSecondsWhenConvertingToPomodoro(2000)).toBe(25 * 60);
  });

  it('computes completion ratio and credited minutes', () => {
    expect(computeCompletionRatio(100, 25)).toBe(0.75);
    expect(creditFocusMinutes(25, 0.75)).toBe(19);
    expect(creditFocusMinutes(25, 0.01)).toBe(1);
  });

  it('scales exercises by completion ratio', () => {
    expect(scaleExercisesByRatio([{ id: 'a', name: 'A', amount: 10, unit: 'reps' }], 0.5)).toEqual([
      { id: 'a', name: 'A', amount: 5, unit: 'reps' }
    ]);
  });
});
