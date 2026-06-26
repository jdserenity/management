import type { BreakVariant, FlowPhase, LongBreakStage } from './flowState';
import type { SessionType } from './sessionTypes';

export const sessionTimerLabel = (
  phase: FlowPhase,
  activeSessionType: SessionType | null,
  breakVariant: BreakVariant | null,
  longBreakStage: LongBreakStage | null
): string => {
  if (phase === 'focus') {
    return activeSessionType === 'pomodoro' ? '🍅 Pomodoro focus' : '🎯 Deep work focus';
  }
  if (phase === 'break' && breakVariant === 'very_light') return '🫖 Very Light Break';
  if (phase === 'break' && longBreakStage === 'very_light') return '🫖 Very Light Break';
  if (phase === 'break' && !activeSessionType) return '🏃 Exercise break';
  if (phase === 'break' && breakVariant === 'short') return '🏃 Exercise break';
  if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'exercise') return '🏃 Exercise break';
  if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'relax') return '☕ Long break · relax';
  if (phase === 'break' && breakVariant === 'long') return '☕ Long break';
  return '🏠 Idle';
};
