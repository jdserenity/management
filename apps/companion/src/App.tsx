import { SessionProvider } from '@/context/SessionContext';
import MobileAppShell from '@/components/MobileAppShell';
import SessionAlerts from '@/components/SessionAlerts';
import CompanionSyncBanner from './components/CompanionSyncBanner';
import { createCompanionSyncClient } from './platform/sync';
import './App.css';

const syncClient = createCompanionSyncClient();

export const App = () => (
  <SessionProvider syncClient={syncClient} syncMode="companion">
    <CompanionSyncBanner />
    <SessionAlerts />
    <MobileAppShell variant="companion" />
  </SessionProvider>
);
