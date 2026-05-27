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
    remainingSeconds,
    sessionStorageReady
  } = useSession();
  const [prefs, setPrefs] = useState<SessionAlertsPrefs>(defaultSessionAlertsPrefs);
  const [prefsReady, setPrefsReady] = useState(false);
  const prevPhaseKeyRef = useRef('idle');
  const phaseAlertsBaselineSetRef = useRef(false);
  const lastCountdownSecondRef = useRef<number | null>(null);
  const trayLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPrefs = () => {
    void loadSessionAlertsPrefs()
      .then((loaded) => {
        setPrefs(loaded);
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
  const alertsActive = prefsReady && sessionStorageReady;

  useEffect(() => {
    if (!alertsActive) return;
    if (trayLabelTimerRef.current) clearTimeout(trayLabelTimerRef.current);
    trayLabelTimerRef.current = setTimeout(() => {
      const formatted = formatSessionTrayTitle(phase, remainingSeconds, activeSessionType, breakVariant, longBreakStage);
      const label = traySessionLabelInvokeArg(phase, formatted);
      invoke('set_tray_session_label', { label }).catch(console.error);
    }, 200);
    return () => {
      if (trayLabelTimerRef.current) clearTimeout(trayLabelTimerRef.current);
    };
  }, [alertsActive, phase, remainingSeconds, activeSessionType, breakVariant, longBreakStage]);

  useEffect(() => {
    if (!alertsActive || phase === 'idle') {
      lastCountdownSecondRef.current = null;
      return;
    }
    if (!prefs.countdownSound || !shouldPlayCountdownBeep(remainingSeconds)) return;
    if (lastCountdownSecondRef.current === remainingSeconds) return;
    lastCountdownSecondRef.current = remainingSeconds;
    playCountdownTick();
  }, [alertsActive, prefs.countdownSound, phase, remainingSeconds]);

  useEffect(() => {
    if (!alertsActive) return;
    if (!phaseAlertsBaselineSetRef.current) {
      prevPhaseKeyRef.current = phaseKey;
      phaseAlertsBaselineSetRef.current = true;
      return;
    }
    const prev = prevPhaseKeyRef.current;
    prevPhaseKeyRef.current = phaseKey;
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
    alertsActive,
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
