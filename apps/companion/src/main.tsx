import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { markCompanionApp } from '@/lib/appRuntime';
import '@/i18n';
import './App.css';

const boot = async () => {
  markCompanionApp();
  const { initCompanionStorage } = await import('./platform/storage');
  await initCompanionStorage();
  const { App } = await import('./App');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

void boot().catch((err) => {
  console.error('[companion] boot failed:', err);
  const root = document.getElementById('root');
  if (root) root.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`;
});
