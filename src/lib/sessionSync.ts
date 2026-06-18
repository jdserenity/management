import { createActiveFlowDocument, createSyncClient, liveRemainingSeconds, type ActiveFlowDocument, type SyncClient } from '@mgmt/sync';
import type { PersistedFlowState } from '@/lib/flowState';

const DEVICE_ID_KEY = 'mgmt_sync_device_id_v1';

export const getOrCreateSyncDeviceId = (): string => {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `desktop-${Date.now()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `desktop-${Date.now()}`;
  }
};

export const createDesktopSyncClient = (): SyncClient =>
  createSyncClient({
    role: 'viewer',
    apiUrl: import.meta.env.VITE_SYNC_API_URL,
    apiToken: import.meta.env.VITE_SYNC_API_TOKEN,
    deviceId: getOrCreateSyncDeviceId(),
    memoryBusKey: 'mgmt-desktop-local'
  });

export const buildActiveFlowDocument = (
  flow: PersistedFlowState,
  deviceId: string,
  phaseEndsAtMs: number,
  updatedAtMs: number = Date.now()
) => createActiveFlowDocument(flow, deviceId, phaseEndsAtMs, updatedAtMs);

export const applyRemoteActiveFlow = (doc: ActiveFlowDocument): { flow: PersistedFlowState; phaseEndsAtMs: number } => {
  const remainingSeconds = liveRemainingSeconds(doc);
  return {
    flow: { ...doc.flow, remainingSeconds },
    phaseEndsAtMs: doc.phaseEndsAtMs
  };
};

export const isRemoteActiveFlow = (doc: ActiveFlowDocument, localDeviceId: string): boolean =>
  doc.leaderDeviceId !== localDeviceId;

export const isSyncViewer = (leaderDeviceId: string | null | undefined, localDeviceId: string): boolean =>
  !!leaderDeviceId && leaderDeviceId !== localDeviceId;

/** Leader id from the latest remote doc; null when the shared session is cleared. */
export const syncLeaderDeviceIdFromDoc = (doc: ActiveFlowDocument | null): string | null =>
  doc?.leaderDeviceId ?? null;

/** Desktop was following a remote leader and should drop local flow when remote clears. */
export const shouldFollowRemoteFlowClear = (
  leaderDeviceId: string | null,
  localDeviceId: string,
  localPhase: PersistedFlowState['phase']
): boolean => isSyncViewer(leaderDeviceId, localDeviceId) && localPhase !== 'idle';
