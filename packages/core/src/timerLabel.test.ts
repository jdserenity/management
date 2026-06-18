import { describe, expect, it } from 'vitest';
import { sessionTimerLabel } from './timerLabel';

describe('sessionTimerLabel', () => {
  it('matches dashboard timer labels', () => {
    expect(sessionTimerLabel('focus', 'pomodoro', null, null)).toBe('🍅 Pomodoro focus');
    expect(sessionTimerLabel('break', 'pomodoro', 'short', null)).toBe('🏃 Exercise break');
    expect(sessionTimerLabel('break', 'deep', 'long', 'relax')).toBe('☕ Long break · relax');
    expect(sessionTimerLabel('idle', null, null, null)).toBe('🏠 Idle');
  });
});
