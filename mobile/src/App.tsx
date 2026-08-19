import { SessionProvider } from '@/context/SessionContext';
import MobileAppShell from '@/components/MobileAppShell';
import SessionAlerts from '@/components/SessionAlerts';
import SyncWarningBanner from '@/components/SyncWarningBanner';
import { FEATURE_WORK } from '@/lib/features';
import { createCompanionSyncClient } from './platform/sync';
import './App.css';

const syncClient = createCompanionSyncClient();

export const App = () => (
  <SessionProvider syncClient={syncClient} syncMode="companion">
    <SyncWarningBanner />
    {FEATURE_WORK ? <SessionAlerts /> : null}
    <MobileAppShell variant="companion" />
  </SessionProvider>
);
