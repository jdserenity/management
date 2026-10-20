import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { markCompanionApp } from '@/lib/appRuntime';
import CompanionBoot from './CompanionBoot';
import { installNoZoom } from './installNoZoom';
import './App.css';

markCompanionApp();
installNoZoom();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CompanionBoot />
  </StrictMode>
);
