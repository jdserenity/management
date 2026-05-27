import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSession } from '@/context/SessionContext';
import {
  formatSessionTrayTitle,
  sessionPhaseNotifyCopy,
  shouldPlayCountdownBeep,
  traySessionLabelInvokeArg
} from '@/lib/sessionAlertLabels';
import {
  defaultSessionAlertsPrefs,
  loadSessionAlertsPrefs,
  SESSION_ALERTS_PREFS_CHANGED,
  type SessionAlertsPrefs
} from '@/lib/sessionAlertsPref';
import { playCountdownTick, playPhaseChangeChime } from '@/lib/sessionSounds';

const phaseSnapshotKey = (
  phase: string,
  breakVariant: string | null,
  longBreakStage: string | null,
  activeSessionType: string | null
): string =>
  phase === 'idle' ? 'idle' : `${phase}|${breakVariant ?? ''}|${longBreakStage ?? ''}|${activeSessionType ?? ''}`;

/** Sounds, notifications, focus, and menu-bar timer label for the session flow. */
const SessionAlerts = () => {
  const {
    phase,
    breakVariant,
    longBreakStage,
    activeSessionType,
    remainingSeconds
  } = useSession();
  const [prefs, setPrefs] = useState<SessionAlertsPrefs>(defaultSessionAlertsPrefs);
  const [prefsReady, setPrefsReady] = useState(false);
  const prevPhaseKeyRef = useRef('idle');
  const skipInitialPhaseAlertRef = useRef(true);
  const lastCountdownSecondRef = useRef<number | null>(null);

  const loadPrefs = () => {
    void loadSessionAlertsPrefs()
      .then(async (loaded) => {
        setPrefs(loaded);
        await invoke('set_session_tray_timer_enabled', { enabled: loaded.trayTimer });
        setPrefsReady(true);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadPrefs();
    const onPrefsChanged = () => loadPrefs();
    window.addEventListener(SESSION_ALERTS_PREFS_CHANGED, onPrefsChanged);
    return () => window.removeEventListener(SESSION_ALERTS_PREFS_CHANGED, onPrefsChanged);
  }, []);

  const phaseKey = phaseSnapshotKey(phase, breakVariant, longBreakStage, activeSessionType);

  useEffect(() => {
    if (!prefsReady) return;
    const formatted = formatSessionTrayTitle(phase, remainingSeconds, activeSessionType, breakVariant, longBreakStage);
    const label = traySessionLabelInvokeArg(phase, formatted);
    invoke('set_tray_session_label', { label }).catch(console.error);
  }, [
    prefsReady,
    phase,
    remainingSeconds,
    activeSessionType,
    breakVariant,
    longBreakStage
  ]);

  useEffect(() => {
    if (!prefsReady || phase === 'idle') {
      lastCountdownSecondRef.current = null;
      return;
    }
    if (!prefs.countdownSound || !shouldPlayCountdownBeep(remainingSeconds)) return;
    if (lastCountdownSecondRef.current === remainingSeconds) return;
    lastCountdownSecondRef.current = remainingSeconds;
    playCountdownTick();
  }, [prefsReady, prefs.countdownSound, phase, remainingSeconds]);

  useEffect(() => {
    if (!prefsReady) return;
    const prev = prevPhaseKeyRef.current;
    prevPhaseKeyRef.current = phaseKey;
    if (skipInitialPhaseAlertRef.current) {
      skipInitialPhaseAlertRef.current = false;
      return;
    }
    if (prev === phaseKey) return;

    const enteringActive = phase !== 'idle';
    const leftActive = prev !== 'idle' && phase === 'idle';

    if (enteringActive) {
      if (prefs.sound) playPhaseChangeChime();
      if (prefs.focusWindow) invoke('focus_main_window', { dockBounce: prefs.dockBounce }).catch(console.error);
      if (prefs.notify) {
        const copy = sessionPhaseNotifyCopy(phase, activeSessionType, breakVariant, longBreakStage);
        if (copy) invoke('notify_session_phase', { title: copy.title, body: copy.body }).catch(console.error);
      }
      return;
    }

    if (leftActive) {
      if (prefs.sound) playPhaseChangeChime();
      if (prefs.focusWindow) invoke('focus_main_window', { dockBounce: prefs.dockBounce }).catch(console.error);
      if (prefs.notify) {
        invoke('notify_session_phase', {
          title: 'Session flow ended',
          body: 'Your scheduled focus and break chain has finished.'
        }).catch(console.error);
      }
    }
  }, [
    prefsReady,
    prefs.sound,
    prefs.focusWindow,
    prefs.dockBounce,
    prefs.notify,
    phaseKey,
    phase,
    activeSessionType,
    breakVariant,
    longBreakStage
  ]);

  return null;
};

export default SessionAlerts;
