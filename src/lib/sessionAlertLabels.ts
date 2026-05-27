import type { BreakVariant, FlowPhase, LongBreakStage } from '@/lib/flowState';
import type { SessionType } from '@/lib/workoutPlanner';

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const formatTimerMmSs = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${pad2(r)}`;
};

export const formatSessionTrayTitle = (
  phase: FlowPhase,
  remainingSeconds: number,
  activeSessionType: SessionType | null,
  breakVariant: BreakVariant | null,
  longBreakStage: LongBreakStage | null
): string | null => {
  if (phase === 'idle') return null;
  const time = formatTimerMmSs(remainingSeconds);
  if (phase === 'focus') {
    const tag = activeSessionType === 'deep' ? 'DW' : 'P';
    return `${tag} ${time}`;
  }
  if (longBreakStage === 'relax') return `Relax ${time}`;
  if (breakVariant === 'long') return `Break ${time}`;
  return `Break ${time}`;
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
  if (longBreakStage === 'relax') return { title: 'Long break', body: 'Relax time — stretch and rest.' };
  if (breakVariant === 'long') return { title: 'Long break', body: 'Exercise break started.' };
  return { title: 'Break', body: 'Break started — time for movement.' };
};

/** Seconds left in phase when countdown beeps should fire (inclusive). */
export const COUNTDOWN_BEEP_SECONDS = [5, 4, 3, 2, 1] as const;

export const shouldPlayCountdownBeep = (remainingSeconds: number): boolean =>
  (COUNTDOWN_BEEP_SECONDS as readonly number[]).includes(remainingSeconds);
