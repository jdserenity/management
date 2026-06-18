import { advanceBreakWhenTimerEnds, type PersistedFlowState } from '@mgmt/core';

export type BreakTimerEndAction =
  | { kind: 'clear' }
  | { kind: 'advance'; flow: PersistedFlowState; phaseEndsAtMs: number };

export const resolveBreakTimerEnd = (flow: PersistedFlowState, nowMs?: number): BreakTimerEndAction => {
  const advanced = advanceBreakWhenTimerEnds(flow, nowMs);
  if (advanced.kind === 'finish') return { kind: 'clear' };
  return { kind: 'advance', flow: advanced.flow, phaseEndsAtMs: advanced.phaseEndsAtMs };
};

export const shouldAttemptBreakAdvance = (isLeader: boolean, phase: string, remainingSeconds: number): boolean =>
  isLeader && phase === 'break' && remainingSeconds <= 0;

export const shouldSkipBreakAdvanceForDoc = (docUpdatedAtMs: number, lastAdvancedAtMs: number): boolean =>
  docUpdatedAtMs <= lastAdvancedAtMs;
