/** macOS display sleep (lid close) — desktop Tauri only. */
export const FLOW_LID_PAUSE_EVENT = 'flow-lid-pause';
export const FLOW_LID_RESUME_EVENT = 'flow-lid-resume';

export const phaseEndsAtMsAfterLidResume = (remainingSeconds: number, nowMs: number): number =>
  nowMs + remainingSeconds * 1000;
