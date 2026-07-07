import { flowRemainingSecondsLive, phaseEndsAtFromFlow, type PersistedFlowState } from '@mgmt/core';
import type { ActiveFlowDocument } from './types';

export const createActiveFlowDocument = (
  flow: PersistedFlowState,
  leaderDeviceId: string,
  phaseEndsAtMs?: number,
  updatedAtMs: number = Date.now()
): ActiveFlowDocument => ({
  version: 1,
  flow,
  phaseEndsAtMs: phaseEndsAtMs ?? phaseEndsAtFromFlow(flow, updatedAtMs),
  updatedAtMs,
  leaderDeviceId
});

export const liveRemainingSeconds = (doc: ActiveFlowDocument, nowMs: number = Date.now()): number =>
  flowRemainingSecondsLive(doc.flow, doc.phaseEndsAtMs, nowMs);

export const mergeActiveFlowDocument = (
  current: ActiveFlowDocument | null,
  incoming: ActiveFlowDocument
): ActiveFlowDocument => {
  if (!current) return incoming;
  if (incoming.updatedAtMs >= current.updatedAtMs) return incoming;
  return current;
};
