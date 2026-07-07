import type { PersistedFlowState } from './flowState';

export const remainingSecondsFromEndsAt = (phaseEndsAtMs: number, nowMs: number = Date.now()): number =>
  Math.max(0, Math.ceil((phaseEndsAtMs - nowMs) / 1000));

export const phaseEndsAtFromFlow = (flow: PersistedFlowState, anchorMs: number = Date.now()): number =>
  anchorMs + Math.max(0, flow.remainingSeconds) * 1000;

export const flowRemainingSecondsLive = (
  flow: PersistedFlowState,
  phaseEndsAtMs: number,
  nowMs: number = Date.now()
): number => {
  if (flow.phase === 'idle') return 0;
  return remainingSecondsFromEndsAt(phaseEndsAtMs, nowMs);
};
