// src/App.tsx

import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SessionProvider } from '@/context/SessionContext';
import { PostureSessionProvider } from '@/context/PostureSessionContext';
import PosturePipeline from '@/components/PosturePipeline';
import AppShell from '@/components/AppShell';
import SessionAlerts from '@/components/SessionAlerts';
import './App.css';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';
import { applyPostureMonitoringFromPref } from '@/lib/postureMonitoringPref';
import { applyAppPresenceFromPref } from '@/lib/appPresencePref';
import { loadSessionAlertsPrefs } from '@/lib/sessionAlertsPref';
import { primeSessionAudio } from '@/lib/sessionSounds';
import SyncWarningBanner from '@/components/SyncWarningBanner';

function App() {

  useEffect(() => {
    invoke('set_current_language', { lang: 'en' }).catch(console.error);
    const prime = () => primeSessionAudio();
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await applyAppPresenceFromPref((mode) => invoke('set_app_presence_mode', { mode }));
        const alerts = await loadSessionAlertsPrefs();
        await invoke('set_session_tray_timer_enabled', { enabled: alerts.trayTimer });
      } catch (e) {
        console.error(e);
      }
    })();
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
      <SyncWarningBanner />
      <SessionAlerts />
      <PostureSessionProvider>
      <PosturePipeline />
      <AppShell />
      </PostureSessionProvider>
    </SessionProvider>
  );
}

export default App;
