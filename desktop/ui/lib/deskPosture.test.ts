import { describe, expect, it } from 'vitest';
import { idleFlow } from '@mgmt/core';
import { focusDeskPosture, nextDeskPostureIfPomodoro, togglePomodoroPosture } from '@/lib/deskPosture';

describe('deskPosture', () => {
  it('focusDeskPosture is null when idle', () => {
    expect(focusDeskPosture(idleFlow())).toBeNull();
  });

  it('focus deep is always sitting; pomodoro uses flow posture', () => {
    const base = idleFlow();
    expect(focusDeskPosture({ ...base, phase: 'focus', activeSessionType: 'deep', pomodoroPosture: 'standing' })).toBe('sitting');
    expect(focusDeskPosture({ ...base, phase: 'focus', activeSessionType: 'pomodoro', pomodoroPosture: 'standing' })).toBe('standing');
  });

  it('nextDeskPostureIfPomodoro flips after a pomodoro focus', () => {
    const flow = {
      ...idleFlow(),
      phase: 'focus' as const,
      activeSessionType: 'pomodoro' as const,
      nextSessionType: 'pomodoro' as const,
      pomodoroPosture: 'sitting' as const
    };
    expect(nextDeskPostureIfPomodoro(flow)).toBe('standing');
  });

  it('togglePomodoroPosture only in pomodoro focus', () => {
    const flow = { ...idleFlow(), phase: 'focus' as const, activeSessionType: 'pomodoro' as const, pomodoroPosture: 'sitting' as const };
    expect(togglePomodoroPosture(flow).pomodoroPosture).toBe('standing');
    expect(togglePomodoroPosture(idleFlow())).toEqual(idleFlow());
  });
});
