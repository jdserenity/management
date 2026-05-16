// src/App.tsx

import { useState, useEffect, type ComponentType } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { SessionProvider } from '@/context/SessionContext';
import Dashboard from '@/components/Dashboard';
import WebcamCapture from '@/components/WebcamCapture';
import CustomizeWorkoutPage from '@/components/CustomizeWorkoutPage';
import StatsPage from '@/components/StatsPage';
import SettingsPage from '@/components/SettingsPage';
import { LayoutDashboard, Camera, Settings, SlidersHorizontal, BarChart3 } from 'lucide-react';
import './App.css';
import i18n from './i18n';
import { useTranslation } from 'react-i18next';

const normalizeLanguage = (lang: string | undefined): string => {
  if (!lang) return 'en';
  const lowered = lang.toLowerCase();
  if (lowered.startsWith('ko')) return 'ko';
  if (lowered.startsWith('ja')) return 'ja';
  if (lowered.startsWith('zh')) return 'zh';
  if (lowered.startsWith('tr')) return 'tr';
  return 'en';
};

type NavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: Dashboard },
  { id: 'monitoring', label: 'Monitoring', icon: Camera, component: WebcamCapture },
  { id: 'customize', label: 'Customize workout', icon: SlidersHorizontal, component: CustomizeWorkoutPage },
  { id: 'stats', label: 'Stats', icon: BarChart3, component: StatsPage },
  { id: 'settings', label: 'Settings', icon: Settings, component: SettingsPage },
];

function App() {
  const { t } = useTranslation();
  const [activeComponentId, setActiveComponentId] = useState('dashboard');

  const ActiveComponent = navItems.find((item) => item.id === activeComponentId)?.component || Dashboard;

  useEffect(() => {
    const syncLanguageToBackend = (lang: string | undefined) => {
      const normalized = normalizeLanguage(lang);
      localStorage.setItem('pose_nudge_language', normalized);
      invoke('set_current_language', { lang: normalized }).catch(console.error);
    };

    syncLanguageToBackend(i18n.resolvedLanguage ?? i18n.language);

    const handleLanguageChanged = (lang: string) => {
      syncLanguageToBackend(lang);
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    const batterySavingMode = localStorage.getItem('pose_nudge_battery_saving_mode') === 'true';
    invoke('set_battery_saving_mode', { mode: batterySavingMode }).catch(console.error);

    const savedCameraIndex = Number.parseInt(localStorage.getItem('pose_nudge_camera_index') || '0', 10);
    if (!Number.isNaN(savedCameraIndex) && savedCameraIndex >= 0) {
      invoke('set_selected_camera', { index: savedCameraIndex }).catch(console.error);
    }

    const monitoringInterval = localStorage.getItem('pose_nudge_monitoring_interval') || '3';
    if (batterySavingMode) {
      invoke('set_monitoring_interval', { intervalMins: parseInt(monitoringInterval, 10) }).catch(console.error);
    } else {
      invoke('set_monitoring_interval', { intervalSecs: parseInt(monitoringInterval, 10) }).catch(console.error);
    }

    const frequency = batterySavingMode ? 1 : parseInt(localStorage.getItem('pose_nudge_notification_frequency') || '2', 10);
    invoke('set_detection_settings', {
      frequency,
      turtleSensitivity: parseInt(localStorage.getItem('pose_nudge_turtle_neck_sensitivity') || '2', 10),
      shoulderSensitivity: parseInt(localStorage.getItem('pose_nudge_shoulder_sensitivity') || '2', 10),
    }).catch(console.error);
  }, []);

  return (
    <SessionProvider>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <header className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-3 py-2 md:px-4">
          <nav className="flex flex-wrap items-center gap-1" aria-label="Main">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant={activeComponentId === item.id ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2"
                onClick={() => setActiveComponentId(item.id)}
              >
                <item.icon className="h-4 w-4" />
                {t(`nav.${item.id}`, item.label)}
              </Button>
            ))}
          </nav>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
          <ActiveComponent />
        </main>
      </div>
    </SessionProvider>
  );
}

export default App;
