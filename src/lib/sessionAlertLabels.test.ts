import { describe, expect, it } from 'vitest';
import {
  flowStatusLabel,
  formatSessionTrayTitle,
  formatTimerMmSs,
  sessionPhaseNotifyCopy,
  shouldPlayCountdownBeep,
  traySessionLabelInvokeArg
} from '@/lib/sessionAlertLabels';

describe('sessionAlertLabels', () => {
  it('formats mm:ss', () => {
    expect(formatTimerMmSs(125)).toBe('2:05');
    expect(formatTimerMmSs(0)).toBe('0:00');
  });

  it('formats tray title for focus and break', () => {
    expect(formatSessionTrayTitle('focus', 90, 'pomodoro', null, null, false)).toBe('🍅 1:30');
    expect(formatSessionTrayTitle('focus', 60, 'deep', null, null, false)).toBe('🎯 1:00');
    expect(formatSessionTrayTitle('break', 300, null, 'short', null, true)).toBe('🏃 5:00');
    expect(formatSessionTrayTitle('break', 300, 'pomodoro', 'short', null, false)).toBe('☕ 5:00');
    expect(formatSessionTrayTitle('break', 600, null, 'long', 'relax', false)).toBe('☕ 10:00');
    expect(formatSessionTrayTitle('idle', 0, null, null, null, false)).toBeNull();
  });

  it('flow status label omits timer and reflects short breaks without exercise', () => {
    expect(flowStatusLabel('focus', 'pomodoro', null, null, false)).toBe('🍅 Pomodoro focus');
    expect(flowStatusLabel('break', 'pomodoro', 'short', null, false)).toBe('☕ Short break');
    expect(flowStatusLabel('break', 'pomodoro', 'short', null, true)).toBe('🏃 Exercise break');
  });

  it('countdown beeps only at 5..1', () => {
    expect(shouldPlayCountdownBeep(5)).toBe(true);
    expect(shouldPlayCountdownBeep(6)).toBe(false);
    expect(shouldPlayCountdownBeep(1)).toBe(true);
    expect(shouldPlayCountdownBeep(0)).toBe(false);
  });

  it('tray invoke arg clears on idle', () => {
    expect(traySessionLabelInvokeArg('idle', '🍅 1:00')).toBe('');
    expect(traySessionLabelInvokeArg('focus', '🍅 1:00')).toBe('🍅 1:00');
  });

  it('phase notify copy for focus and break', () => {
    expect(sessionPhaseNotifyCopy('focus', 'pomodoro', null, null)?.title).toBe('Pomodoro');
    expect(sessionPhaseNotifyCopy('break', null, 'long', 'exercise')?.title).toBe('Long break');
  });
});
