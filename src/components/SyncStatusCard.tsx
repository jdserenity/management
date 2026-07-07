import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSyncStatus, SYNC_STATUS_EVENT, type SyncStatusSnapshot } from '@mgmt/sync';

const formatAgo = (ts: number | null): string => {
  if (!ts) return 'Never';
  const deltaSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (deltaSec < 5) return 'Just now';
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const mins = Math.floor(deltaSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const operationLabel = (status: SyncStatusSnapshot): string => {
  if (!status.lastOperation) return 'No sync operation yet';
  const op = status.lastOperation === 'pull'
    ? 'Pull'
    : status.lastOperation === 'push-patch'
      ? 'Row patch push'
      : 'Full snapshot push';
  const verdict = status.lastOperationOk === null
    ? 'pending'
    : status.lastOperationOk
      ? 'ok'
      : 'failed';
  return `${op}: ${verdict}`;
};

export default function SyncStatusCard() {
  const [status, setStatus] = useState<SyncStatusSnapshot>(() => getSyncStatus());

  useEffect(() => {
    const refresh = () => { setStatus(getSyncStatus()); };
    window.addEventListener(SYNC_STATUS_EVENT, refresh);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, refresh);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><span className="font-medium">Pending local changes:</span> {status.pendingLocalChanges ? 'Yes' : 'No'}</p>
        <p><span className="font-medium">Last operation:</span> {operationLabel(status)}</p>
        <p><span className="font-medium">Last pull:</span> {formatAgo(status.lastPullAtMs)}</p>
        <p><span className="font-medium">Last push:</span> {formatAgo(status.lastPushAtMs)}</p>
        {status.lastErrorMessage ? (
          <p className="text-amber-300"><span className="font-medium">Last error:</span> {status.lastErrorMessage}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
