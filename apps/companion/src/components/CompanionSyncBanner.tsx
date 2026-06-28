import { useEffect, useState } from 'react';
import { getCompanionSyncWarning } from '../platform/storage';

export default function CompanionSyncBanner() {
  const [warning, setWarning] = useState<string | null>(() => getCompanionSyncWarning());

  useEffect(() => {
    setWarning(getCompanionSyncWarning());
    const onRefresh = () => { setWarning(getCompanionSyncWarning()); };
    window.addEventListener('mgmt-companion-data-refresh', onRefresh);
    return () => window.removeEventListener('mgmt-companion-data-refresh', onRefresh);
  }, []);

  if (!warning) return null;

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100" role="status">
      <strong className="font-semibold">Sync issue:</strong> {warning}
    </div>
  );
}
