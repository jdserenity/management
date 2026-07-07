import { SessionProvider } from '@/context/SessionContext';
import MobileAppShell from '@/components/MobileAppShell';
import SessionAlerts from '@/components/SessionAlerts';
import SyncWarningBanner from '@/components/SyncWarningBanner';
import { createCompanionSyncClient } from './platform/sync';
import './App.css';

const syncClient = createCompanionSyncClient();

export const App = () => (
  <SessionProvider syncClient={syncClient} syncMode="companion">
    <SyncWarningBanner />
    <SessionAlerts />
    <MobileAppShell variant="companion" />
  </SessionProvider>
);
