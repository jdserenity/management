import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { markCompanionApp } from '@/lib/appRuntime';
import CompanionBoot from './CompanionBoot';
import './App.css';

markCompanionApp();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CompanionBoot />
  </StrictMode>
);
