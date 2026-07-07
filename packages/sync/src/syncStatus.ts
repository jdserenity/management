export const SYNC_STATUS_EVENT = 'mgmt-sync-status';

export type SyncOperation = 'pull' | 'push-full' | 'push-patch';

export interface SyncStatusSnapshot {
  pendingLocalChanges: boolean;
  lastOperation: SyncOperation | null;
  lastOperationOk: boolean | null;
  lastPullAtMs: number | null;
  lastPushAtMs: number | null;
  lastErrorAtMs: number | null;
  lastErrorMessage: string | null;
}

let status: SyncStatusSnapshot = {
  pendingLocalChanges: false,
  lastOperation: null,
  lastOperationOk: null,
  lastPullAtMs: null,
  lastPushAtMs: null,
  lastErrorAtMs: null,
  lastErrorMessage: null
};

const emitSyncStatus = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SYNC_STATUS_EVENT));
};

const updateStatus = (patch: Partial<SyncStatusSnapshot>): void => {
  status = { ...status, ...patch };
  emitSyncStatus();
};

export const getSyncStatus = (): SyncStatusSnapshot => status;

export const resetSyncStatusForTests = (): void => {
  status = {
    pendingLocalChanges: false,
    lastOperation: null,
    lastOperationOk: null,
    lastPullAtMs: null,
    lastPushAtMs: null,
    lastErrorAtMs: null,
    lastErrorMessage: null
  };
  emitSyncStatus();
};

export const markLocalSyncChangePending = (): void => {
  if (status.pendingLocalChanges) return;
  updateStatus({ pendingLocalChanges: true });
};

export const markSyncPullResult = (ok: boolean, errorMessage?: string): void => {
  const now = Date.now();
  if (ok) {
    updateStatus({
      lastOperation: 'pull',
      lastOperationOk: true,
      lastPullAtMs: now,
      lastErrorMessage: null
    });
    return;
  }
  updateStatus({
    lastOperation: 'pull',
    lastOperationOk: false,
    lastErrorAtMs: now,
    lastErrorMessage: errorMessage ?? 'Pull failed.'
  });
};

export const markSyncPushResult = (
  op: 'push-full' | 'push-patch',
  ok: boolean,
  errorMessage?: string
): void => {
  const now = Date.now();
  if (ok) {
    updateStatus({
      pendingLocalChanges: false,
      lastOperation: op,
      lastOperationOk: true,
      lastPushAtMs: now,
      lastErrorMessage: null
    });
    return;
  }
  updateStatus({
    lastOperation: op,
    lastOperationOk: false,
    lastErrorAtMs: now,
    lastErrorMessage: errorMessage ?? 'Push failed.'
  });
};
