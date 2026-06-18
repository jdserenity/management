import { createActiveFlowDocument, mergeActiveFlowDocument } from './flowSync';
import type { ActiveFlowDocument, SyncClient, SyncClientOptions, SyncConnectionStatus, SyncDeviceRole } from './types';

const createDeviceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `dev-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
};

/** In-process sync bus for local dev and tests until a remote provider is wired. */
export class MemorySyncClient implements SyncClient {
  readonly deviceId: string;
  readonly role: SyncDeviceRole;
  private status: SyncConnectionStatus = 'online';
  private activeFlow: ActiveFlowDocument | null = null;
  private readonly listeners = new Set<(doc: ActiveFlowDocument | null) => void>();
  private static buses = new Map<string, MemorySyncClient[]>();

  constructor(private readonly busKey: string = 'default', options: SyncClientOptions = {}) {
    this.deviceId = options.deviceId ?? createDeviceId();
    this.role = options.role ?? 'viewer';
    const peers = MemorySyncClient.buses.get(busKey) ?? [];
    peers.push(this);
    MemorySyncClient.buses.set(busKey, peers);
  }

  getStatus(): SyncConnectionStatus {
    return this.status;
  }

  setStatus(status: SyncConnectionStatus): void {
    this.status = status;
  }

  subscribeActiveFlow(listener: (doc: ActiveFlowDocument | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.activeFlow);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async publishActiveFlow(doc: ActiveFlowDocument | null): Promise<void> {
    const normalized = doc
      ? createActiveFlowDocument(doc.flow, this.deviceId, doc.phaseEndsAtMs, doc.updatedAtMs)
      : null;
    const peers = MemorySyncClient.buses.get(this.busKey) ?? [];
    for (const peer of peers) {
      peer.activeFlow = normalized;
      for (const listener of peer.listeners) listener(normalized);
    }
  }

  /** Test helper: apply an incoming doc as a viewer would. */
  ingest(doc: ActiveFlowDocument | null): void {
    this.activeFlow = doc;
    for (const listener of this.listeners) listener(doc);
  }

  /** Test helper: simulate remote publish with merge semantics. */
  receive(doc: ActiveFlowDocument): void {
    this.activeFlow = mergeActiveFlowDocument(this.activeFlow, doc);
    for (const listener of this.listeners) listener(this.activeFlow);
  }
}

export const createMemorySyncPair = (
  busKey: string = 'default'
): { leader: MemorySyncClient; viewer: MemorySyncClient } => ({
  leader: new MemorySyncClient(busKey, { role: 'leader' }),
  viewer: new MemorySyncClient(busKey, { role: 'viewer' })
});
