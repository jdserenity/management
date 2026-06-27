import type { BreakVariant, FlowPhase, LongBreakStage } from '@/lib/flowState';
import type { SessionType } from '@/lib/workoutPlanner';

/** Match Dashboard flow labels. */
export const SESSION_FLOW_EMOJI = {
  pomodoro: '🍅',
  deep: '🎯',
  exerciseBreak: '🏃',
  relax: '☕',
  veryLight: '🫖'
} as const;

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const formatTimerMmSs = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${pad2(r)}`;
};

/** Flow label for header chip and tray status — no countdown. */
export const flowStatusLabel = (
  phase: FlowPhase,
  activeSessionType: SessionType | null,
  breakVariant: BreakVariant | null,
  longBreakStage: LongBreakStage | null,
  hasActiveWorkout: boolean
): string => {
  if (phase === 'focus') return activeSessionType === 'pomodoro' ? '🍅 Pomodoro focus' : '🎯 Deep work focus';
  if (phase === 'break' && breakVariant === 'very_light') return '🫖 Very Light Break';
  if (phase === 'break' && longBreakStage === 'very_light') return '🫖 Very Light Break';
  if (phase === 'break' && !activeSessionType) return '🏃 Exercise break';
  if (phase === 'break' && breakVariant === 'short') return hasActiveWorkout ? '🏃 Exercise break' : '☕ Short break';
  if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'exercise') return '🏃 Exercise break';
  if (phase === 'break' && breakVariant === 'long' && longBreakStage === 'relax') return '☕ Long break · relax';
  if (phase === 'break' && breakVariant === 'long') return '☕ Long break';
  return '🏠 Idle';
};

export const formatSessionTrayTitle = (
  phase: FlowPhase,
  remainingSeconds: number,
  activeSessionType: SessionType | null,
  breakVariant: BreakVariant | null,
  longBreakStage: LongBreakStage | null,
  hasActiveWorkout: boolean
): string | null => {
  if (phase === 'idle') return null;
  const time = formatTimerMmSs(remainingSeconds);
  if (phase === 'focus') {
    const emoji = activeSessionType === 'deep' ? SESSION_FLOW_EMOJI.deep : SESSION_FLOW_EMOJI.pomodoro;
    return `${emoji} ${time}`;
  }
  if (longBreakStage === 'relax') return `${SESSION_FLOW_EMOJI.relax} ${time}`;
  if (breakVariant === 'very_light' || longBreakStage === 'very_light') return `${SESSION_FLOW_EMOJI.veryLight} ${time}`;
  if (breakVariant === 'short' && !hasActiveWorkout) return `${SESSION_FLOW_EMOJI.relax} ${time}`;
  return `${SESSION_FLOW_EMOJI.exerciseBreak} ${time}`;
};

/** Value sent to `set_tray_session_label` — empty string clears the menu bar title on macOS. */
export const traySessionLabelInvokeArg = (phase: FlowPhase, formatted: string | null): string =>
  phase === 'idle' ? '' : (formatted ?? '');

export interface SessionPhaseNotifyCopy {
  title: string;
  body: string;
}

export const sessionPhaseNotifyCopy = (
  phase: FlowPhase,
  activeSessionType: SessionType | null,
  breakVariant: BreakVariant | null,
  longBreakStage: LongBreakStage | null
): SessionPhaseNotifyCopy | null => {
  if (phase === 'idle') return null;
  if (phase === 'focus') {
    if (activeSessionType === 'deep') return { title: 'Deep work', body: 'Focus session started.' };
    return { title: 'Pomodoro', body: 'Focus session started.' };
  }
  if (longBreakStage === 'very_light') return { title: 'Very Light Break', body: 'Quiet break — water, bathroom, or phone.' };
  if (longBreakStage === 'relax') return { title: 'Long break', body: 'Relax time — stretch and rest.' };
  if (breakVariant === 'very_light') return { title: 'Very Light Break', body: 'Quiet break — water, bathroom, or phone.' };
  if (breakVariant === 'long') return { title: 'Long break', body: 'Exercise break started.' };
  return { title: 'Break', body: 'Break started — time for movement.' };
};

/** Seconds left in phase when countdown beeps should fire (inclusive). */
export const COUNTDOWN_BEEP_SECONDS = [5, 4, 3, 2, 1] as const;

export const shouldPlayCountdownBeep = (remainingSeconds: number): boolean =>
  (COUNTDOWN_BEEP_SECONDS as readonly number[]).includes(remainingSeconds);
