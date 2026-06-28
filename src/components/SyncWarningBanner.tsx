import { useEffect, useState } from 'react';
import { DATA_SYNC_REFRESH_EVENT, getSyncWarning } from '@mgmt/sync';

export default function SyncWarningBanner() {
  const [warning, setWarning] = useState<string | null>(() => getSyncWarning());

  useEffect(() => {
    const refresh = () => { setWarning(getSyncWarning()); };
    refresh();
    window.addEventListener(DATA_SYNC_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(DATA_SYNC_REFRESH_EVENT, refresh);
  }, []);

  if (!warning) return null;

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100" role="status">
      <strong className="font-semibold">Sync issue:</strong> {warning}
    </div>
  );
}
