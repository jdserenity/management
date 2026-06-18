import { CompanionSessionProvider } from './context/CompanionSessionContext';
import { BreakSessionView } from './components/BreakSessionView';
import { createCompanionSyncClient } from './platform/sync';
import './App.css';

const syncClient = createCompanionSyncClient();

export const App = () => (
  <CompanionSessionProvider client={syncClient}>
    <main className="mx-auto min-h-dvh max-w-md space-y-4 p-4">
      <BreakSessionView />
    </main>
  </CompanionSessionProvider>
);
