import { describe, expect, it } from 'vitest';
import {
  breakTimerEndAction,
  canConvertFocusSession,
  computeCompletionRatio,
  creditFocusMinutes,
  focusElapsedSeconds,
  isFlowLongEnoughToDisplay,
  isPhaseLongEnoughToLog,
  MIN_PHASE_LOG_SECONDS,
  phaseElapsedSeconds,
  remainingSecondsWhenConvertingToDeep,
  remainingSecondsWhenConvertingToPomodoro,
  scaleExercisesByRatio,
  showSessionChainControls
} from '@/lib/sessionProgress';

describe('standalone exercise break chain', () => {
  it('shows next-focus controls during any break including standalone', () => {
    expect(showSessionChainControls('break')).toBe(true);
    expect(showSessionChainControls('focus')).toBe(true);
    expect(showSessionChainControls('idle')).toBe(false);
  });

  it('finishes standalone short break when no next session; starts focus when user adds one', () => {
    expect(breakTimerEndAction('short', null, 'pomodoro')).toBe('start_focus');
    expect(breakTimerEndAction('short', null, 'deep')).toBe('start_focus');
    expect(breakTimerEndAction('short', null, null)).toBe('finish');
  });

  it('still advances long break exercise to relax before next focus', () => {
    expect(breakTimerEndAction('long', 'exercise', 'pomodoro')).toBe('long_relax');
    expect(breakTimerEndAction('long', 'relax', 'pomodoro')).toBe('start_focus');
  });
});

describe('isFlowLongEnoughToDisplay', () => {
  it('rejects flows under 15 seconds', () => {
    const start = 1_000_000;
    expect(isFlowLongEnoughToDisplay(start, start + 14_999)).toBe(false);
    expect(isFlowLongEnoughToDisplay(start, start + 15_000)).toBe(true);
  });
});

describe('canConvertFocusSession', () => {
  it('allows conversion only during focus when switching session type', () => {
    expect(canConvertFocusSession('focus', 'pomodoro', 'deep')).toBe(true);
    expect(canConvertFocusSession('focus', 'deep', 'pomodoro')).toBe(true);
    expect(canConvertFocusSession('focus', 'pomodoro', 'pomodoro')).toBe(false);
    expect(canConvertFocusSession('break', 'pomodoro', 'deep')).toBe(false);
    expect(canConvertFocusSession('idle', null, 'deep')).toBe(false);
  });
});

describe('focus conversion remaining time', () => {
  it('subtracts elapsed focus time from deep work (90 min)', () => {
    expect(remainingSecondsWhenConvertingToDeep(10 * 60)).toBe(80 * 60);
    expect(remainingSecondsWhenConvertingToDeep(0)).toBe(90 * 60);
  });

  it('subtracts elapsed from pomodoro unless over 25 min then full pomodoro', () => {
    expect(remainingSecondsWhenConvertingToPomodoro(10 * 60)).toBe(15 * 60);
    expect(remainingSecondsWhenConvertingToPomodoro(25 * 60)).toBe(0);
    expect(remainingSecondsWhenConvertingToPomodoro(25 * 60 + 1)).toBe(25 * 60);
    expect(remainingSecondsWhenConvertingToPomodoro(40 * 60)).toBe(25 * 60);
  });

  it('measures elapsed focus seconds from timer', () => {
    expect(focusElapsedSeconds(25 * 60, 15 * 60)).toBe(10 * 60);
  });
});

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
