import { useEffect, useState } from 'react';
import { getAppKind } from '@/lib/appRuntime';
import { pullAndMergeFromServer, pushLocalDataToServer } from '@/lib/dataSync';
import { getBuildTimeSyncCreds, getSyncStatus, SYNC_STATUS_EVENT, type SyncStatusSnapshot } from '@mgmt/sync';

/** Companion boot registers these so shared UI can force upload without importing mobile paths. */
declare global {
  interface Window {
    __mgmtCompanionPush?: () => Promise<boolean>;
    __mgmtCompanionPull?: () => Promise<boolean>;
  }
}

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
  const [busy, setBusy] = useState<'idle' | 'push' | 'pull'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const kind = getAppKind();
  const creds = getBuildTimeSyncCreds();
  const credsOk = Boolean(creds.serverUrl && creds.serverToken);

  useEffect(() => {
    const refresh = () => { setStatus(getSyncStatus()); };
    window.addEventListener(SYNC_STATUS_EVENT, refresh);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, refresh);
  }, []);

  const runPush = async () => {
    setBusy('push');
    setMessage(null);
    try {
      if (kind === 'companion') {
        if (!window.__mgmtCompanionPush) throw new Error('Companion upload not ready yet — wait for boot, then try again.');
        const ok = await window.__mgmtCompanionPush();
        if (!ok) throw new Error('Upload failed — check Wi‑Fi and that the phone can reach the sync server.');
        setMessage('Phone data uploaded. Next: open desktop → Settings → Sync health → Pull from server.');
      } else {
        await pushLocalDataToServer();
        setMessage('This Mac uploaded. Prefer uploading from the phone if desktop is still missing habits/food/water.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
      setStatus(getSyncStatus());
    }
  };

  const runPull = async () => {
    setBusy('pull');
    setMessage(null);
    try {
      if (kind === 'companion') {
        if (!window.__mgmtCompanionPull) throw new Error('Companion pull not ready yet.');
        const ok = await window.__mgmtCompanionPull();
        if (!ok) throw new Error('Pull failed — check network.');
        setMessage('Pulled from server. Reloading…');
        window.location.reload();
        return;
      }
      await pullAndMergeFromServer();
      setMessage('Merged from server. Open Daily — habits/food/water should update. Reload the app if not.');
      window.dispatchEvent(new Event('mgmt-data-sync-refresh'));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('idle');
      setStatus(getSyncStatus());
    }
  };

  return (
    <section className="plugin-panel space-y-3 text-sm">
      <h2 className="plugin-panel-title">Sync health</h2>
      <p>
        <span className="font-medium">Server credentials:</span>{' '}
        {credsOk ? 'configured in this build' : 'missing — add VITE_SERVER_URL + VITE_SERVER_TOKEN to root .env and restart tauri dev'}
      </p>
      <p><span className="font-medium">Pending local changes:</span> {status.pendingLocalChanges ? 'Yes' : 'No'}</p>
      <p><span className="font-medium">Last operation:</span> {operationLabel(status)}</p>
      <p><span className="font-medium">Last pull:</span> {formatAgo(status.lastPullAtMs)}</p>
      <p><span className="font-medium">Last push:</span> {formatAgo(status.lastPushAtMs)}</p>
      {status.lastErrorMessage ? (
        <p className="text-amber-700 dark:text-amber-300"><span className="font-medium">Last error:</span> {status.lastErrorMessage}</p>
      ) : null}

      <div className="space-y-2 border-t border-border pt-3">
        <p className="font-medium">Recovery</p>
        <p className="plugin-muted text-xs leading-snug">
          {kind === 'companion'
            ? 'If this phone still shows your full habits/food/water, upload first. Then open the desktop app and pull.'
            : 'After the phone has uploaded, pull here. Avoid “Upload this Mac” while desktop is still missing data.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="plugin-btn plugin-btn-primary"
            disabled={busy !== 'idle'}
            onClick={() => { void runPush(); }}
          >
            {busy === 'push' ? 'Uploading…' : kind === 'companion' ? 'Upload this phone to server' : 'Upload this Mac to server'}
          </button>
          <button
            type="button"
            className="plugin-btn"
            disabled={busy !== 'idle'}
            onClick={() => { void runPull(); }}
          >
            {busy === 'pull' ? 'Pulling…' : 'Pull from server'}
          </button>
        </div>
        {message ? <p className="text-xs font-medium">{message}</p> : null}
      </div>
    </section>
  );
}
