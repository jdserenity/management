// src/App.tsx

import { useState, useEffect, type ComponentType } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { SessionProvider } from '@/context/SessionContext';
import { PostureSessionProvider } from '@/context/PostureSessionContext';
import PosturePipeline from '@/components/PosturePipeline';
import Dashboard from '@/components/Dashboard';
import PosturePage from '@/components/PosturePage';
import CustomizeWorkoutPage from '@/components/CustomizeWorkoutPage';
import StatsPage from '@/components/StatsPage';
import SettingsPage from '@/components/SettingsPage';
import { LayoutDashboard, Camera, Settings, SlidersHorizontal, BarChart3 } from 'lucide-react';
import './App.css';
import { useTranslation } from 'react-i18next';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';
import { applyPostureMonitoringFromPref } from '@/lib/postureMonitoringPref';
import { applyAppPresenceFromPref } from '@/lib/appPresencePref';

type NavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: Dashboard },
  { id: 'posture', label: 'Posture', icon: Camera, component: PosturePage },
  { id: 'customize', label: 'Customize workouts', icon: SlidersHorizontal, component: CustomizeWorkoutPage },
  { id: 'stats', label: 'Stats', icon: BarChart3, component: StatsPage },
  { id: 'settings', label: 'Settings', icon: Settings, component: SettingsPage },
];

function App() {
  const { t } = useTranslation();
  const [activeComponentId, setActiveComponentId] = useState('dashboard');

  const ActiveComponent = navItems.find((item) => item.id === activeComponentId)?.component || Dashboard;

  useEffect(() => {
    invoke('set_current_language', { lang: 'en' }).catch(console.error);
  }, []);

  useEffect(() => {
    applyAppPresenceFromPref((mode) => invoke('set_app_presence_mode', { mode })).catch(console.error);
    applyPostureMonitoringFromPref((cmd) => invoke(cmd)).catch(console.error);

    const batterySavingMode = localStorage.getItem(MGMT_LS.batterySavingMode) === 'true';
    invoke('set_battery_saving_mode', { mode: batterySavingMode }).catch(console.error);

    const savedCameraIndex = Number.parseInt(localStorage.getItem(MGMT_LS.cameraIndex) || '0', 10);
    if (!Number.isNaN(savedCameraIndex) && savedCameraIndex >= 0) {
      invoke('set_selected_camera', { index: savedCameraIndex }).catch(console.error);
    }

    const monitoringInterval = localStorage.getItem(MGMT_LS.monitoringInterval) || '3';
    if (batterySavingMode) {
      invoke('set_monitoring_interval', { intervalMins: parseInt(monitoringInterval, 10) }).catch(console.error);
    } else {
      invoke('set_monitoring_interval', { intervalSecs: parseInt(monitoringInterval, 10) }).catch(console.error);
    }

    const frequency = batterySavingMode ? 1 : parseInt(localStorage.getItem(MGMT_LS.notificationFrequency) || '2', 10);
    invoke('set_detection_settings', {
      frequency,
      turtleSensitivity: parseInt(localStorage.getItem(MGMT_LS.turtleNeckSensitivity) || '2', 10),
      shoulderSensitivity: parseInt(localStorage.getItem(MGMT_LS.shoulderSensitivity) || '2', 10),
    }).catch(console.error);
  }, []);

  return (
    <SessionProvider>
      <PostureSessionProvider>
      <PosturePipeline />
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
      </PostureSessionProvider>
    </SessionProvider>
  );
}

export default App;
