import { describe, expect, it } from 'vitest';
import {
  getSyncStatus,
  markLocalSyncChangePending,
  markSyncPullResult,
  markSyncPushResult,
  resetSyncStatusForTests
} from './syncStatus';

describe('syncStatus', () => {
  it('tracks pending local change and clears after successful push', () => {
    resetSyncStatusForTests();
    markLocalSyncChangePending();
    expect(getSyncStatus().pendingLocalChanges).toBe(true);
    markSyncPushResult('push-patch', true);
    expect(getSyncStatus().pendingLocalChanges).toBe(false);
  });

  it('keeps pending changes after failed push', () => {
    resetSyncStatusForTests();
    markLocalSyncChangePending();
    markSyncPushResult('push-patch', false, 'network down');
    const status = getSyncStatus();
    expect(status.pendingLocalChanges).toBe(true);
    expect(status.lastErrorMessage).toContain('network down');
  });

  it('records pull failure then success', () => {
    resetSyncStatusForTests();
    markSyncPullResult(false, 'timeout');
    expect(getSyncStatus().lastOperationOk).toBe(false);
    markSyncPullResult(true);
    expect(getSyncStatus().lastOperationOk).toBe(true);
    expect(getSyncStatus().lastErrorMessage).toBeNull();
  });
});
