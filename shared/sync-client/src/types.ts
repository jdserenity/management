import type { PersistedFlowState } from '@mgmt/core';

export type SyncDeviceRole = 'leader' | 'viewer';

export interface ActiveFlowDocument {
  version: 1;
  flow: PersistedFlowState;
  /** Wall-clock ms when the current phase should end (authoritative for countdown). */
  phaseEndsAtMs: number;
  updatedAtMs: number;
  leaderDeviceId: string;
}

export type SyncConnectionStatus = 'offline' | 'connecting' | 'online' | 'error';

export interface SyncClient {
  readonly deviceId: string;
  readonly role: SyncDeviceRole;
  getStatus(): SyncConnectionStatus;
  getLastError?(): string | null;
  subscribeActiveFlow(listener: (doc: ActiveFlowDocument | null) => void): () => void;
  publishActiveFlow(doc: ActiveFlowDocument | null): Promise<void>;
}

export interface SyncClientOptions {
  deviceId?: string;
  role?: SyncDeviceRole;
}
