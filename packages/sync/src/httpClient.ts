import { normalizeApiUrl } from './apiUrl';
import { createActiveFlowDocument } from './flowSync';
import type { ActiveFlowDocument, SyncClient, SyncConnectionStatus, SyncDeviceRole } from './types';
import { syncFetch } from './syncFetch';

const createDeviceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `dev-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
};

export interface HttpSyncClientOptions {
  baseUrl: string;
  token: string;
  role?: SyncDeviceRole;
  deviceId?: string;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

const parseActiveFlowResponse = (raw: unknown): ActiveFlowDocument | null => {
  if (!raw || typeof raw !== 'object') return null;
  const doc = (raw as { doc?: unknown }).doc;
  if (doc === null) return null;
  if (!doc || typeof doc !== 'object') return null;
  const row = doc as ActiveFlowDocument;
  if (row.version !== 1 || !row.flow || typeof row.phaseEndsAtMs !== 'number') return null;
  return row;
};

export class HttpSyncClient implements SyncClient {
  readonly deviceId: string;
  readonly role: SyncDeviceRole;
  private status: SyncConnectionStatus = 'connecting';
  private activeFlow: ActiveFlowDocument | null = null;
  private readonly listeners = new Set<(doc: ActiveFlowDocument | null) => void>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollBackoffMs = 0;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly pollIntervalMs: number;
  private lastError: string | null = null;

  constructor(options: HttpSyncClientOptions) {
    this.baseUrl = normalizeApiUrl(options.baseUrl) ?? options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
    this.role = options.role ?? 'viewer';
    this.deviceId = options.deviceId ?? createDeviceId();
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.fetchImpl = options.fetchImpl ?? syncFetch;
  }

  getStatus(): SyncConnectionStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  private fail(err: unknown, context: string): void {
    this.lastError = err instanceof Error ? err.message : String(err);
    console.error(`[data-sync] ${context}`, { url: `${this.baseUrl}/v1/active-flow`, error: this.lastError, raw: err });
    this.pollBackoffMs = Math.min(this.pollBackoffMs ? this.pollBackoffMs * 2 : 4000, 60_000);
    this.setStatus('error');
    this.notify();
  }

  private succeed(): void {
    this.lastError = null;
    this.pollBackoffMs = 0;
    this.setStatus('online');
    this.notify();
  }

  private setStatus(status: SyncConnectionStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(this.activeFlow);
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.activeFlow);
  }

  private async pull(): Promise<void> {
    const url = `${this.baseUrl}/v1/active-flow`;
    try {
      const res = await this.fetchImpl(url, { headers: this.headers() });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[data-sync] GET /v1/active-flow HTTP error', { url, status: res.status, body: body.slice(0, 500) });
        throw new Error(`sync pull failed: HTTP ${res.status}`);
      }
      const body = (await res.json()) as unknown;
      this.activeFlow = parseActiveFlowResponse(body);
      this.succeed();
    } catch (err) {
      this.fail(err, 'GET /v1/active-flow failed');
    }
  }

  subscribeActiveFlow(listener: (doc: ActiveFlowDocument | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.activeFlow);
    const schedulePoll = () => {
      if (this.pollTimer) clearInterval(this.pollTimer);
      const ms = this.pollBackoffMs || this.pollIntervalMs;
      this.pollTimer = setInterval(() => void this.pull(), ms);
    };
    void this.pull().finally(schedulePoll);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    };
  }

  async publishActiveFlow(doc: ActiveFlowDocument | null): Promise<void> {
    try {
      const payload = doc
        ? createActiveFlowDocument(doc.flow, this.deviceId, doc.phaseEndsAtMs, doc.updatedAtMs ?? Date.now())
        : null;
      const url = `${this.baseUrl}/v1/active-flow`;
      const res = await this.fetchImpl(url, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({ doc: payload })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[data-sync] PUT /v1/active-flow HTTP error', { url, status: res.status, body: body.slice(0, 500) });
        throw new Error(`sync publish failed: HTTP ${res.status}`);
      }
      const body = (await res.json()) as unknown;
      this.activeFlow = parseActiveFlowResponse(body);
      this.succeed();
    } catch (err) {
      this.fail(err, 'PUT /v1/active-flow failed');
      throw err;
    }
  }
}
