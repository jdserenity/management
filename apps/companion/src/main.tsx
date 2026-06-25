import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { markCompanionApp } from '@/lib/appRuntime';
import { App } from './App';
import './App.css';

const boot = async () => {
  markCompanionApp();
  const { initCompanionStorage } = await import('./platform/storage');
  await initCompanionStorage();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

void boot();
