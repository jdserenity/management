import type { DeskPosture, PersistedFlowState } from '@/lib/flowState';

export const focusDeskPosture = (flow: Pick<PersistedFlowState, 'phase' | 'activeSessionType' | 'pomodoroPosture'>): DeskPosture | null => {
  if (flow.phase !== 'focus' || !flow.activeSessionType) return null;
  if (flow.activeSessionType === 'deep') return 'sitting';
  return flow.pomodoroPosture;
};

const flipFromLast = (prev: DeskPosture | null): DeskPosture =>
  prev === null ? 'sitting' : prev === 'sitting' ? 'standing' : 'sitting';

/** Next sitting/standing for a pomodoro after the current focus/break phase. */
export const nextDeskPostureIfPomodoro = (flow: PersistedFlowState): DeskPosture | null => {
  if (flow.nextSessionType !== 'pomodoro') return null;
  if (flow.phase === 'focus' && flow.activeSessionType === 'pomodoro') {
    return flow.pomodoroPosture === 'sitting' ? 'standing' : 'sitting';
  }
  if (flow.phase === 'focus' && flow.activeSessionType === 'deep') return flipFromLast(flow.lastPomodoroPosture);
  if (flow.phase === 'break') return flipFromLast(flow.lastPomodoroPosture);
  return null;
};

export const togglePomodoroPosture = (prev: PersistedFlowState): PersistedFlowState => {
  if (prev.phase !== 'focus' || prev.activeSessionType !== 'pomodoro') return prev;
  return { ...prev, pomodoroPosture: prev.pomodoroPosture === 'sitting' ? 'standing' : 'sitting' };
};
