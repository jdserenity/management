import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSession } from '@/context/SessionContext';
import { isTauri } from '@/lib/isTauri';
import {
  formatSessionTrayTitle,
  sessionPhaseNotifyCopy,
  traySessionLabelInvokeArg
} from '@/lib/sessionAlertLabels';
import { requestGoToWorkTab } from '@/lib/navConfig';
import {
  defaultSessionAlertsPrefs,
  loadSessionAlertsPrefs,
  SESSION_ALERTS_PREFS_CHANGED,
  type SessionAlertsPrefs
} from '@/lib/sessionAlertsPref';
import { playCountdownTick, playPhaseChangeChime, scheduleCountdownBeeps } from '@/lib/sessionSounds';

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
    activeWorkout,
    sessionStorageReady,
    takeBackgroundFlowStart
  } = useSession();
  const [prefs, setPrefs] = useState<SessionAlertsPrefs>(defaultSessionAlertsPrefs);
  const [prefsReady, setPrefsReady] = useState(false);
  const prevPhaseKeyRef = useRef('idle');
  const phaseAlertsBaselineSetRef = useRef(false);
  const countdownScheduledForPhaseRef = useRef<string | null>(null);
  const cancelCountdownRef = useRef<(() => void) | null>(null);
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
    if (!prefs.trayTimer) {
      if (isTauri()) invoke('set_tray_session_label', { label: '' }).catch(console.error);
      return;
    }
    trayLabelTimerRef.current = setTimeout(() => {
      const formatted = formatSessionTrayTitle(
        phase,
        remainingSeconds,
        activeSessionType,
        breakVariant,
        longBreakStage,
        Boolean(activeWorkout)
      );
      const label = traySessionLabelInvokeArg(phase, formatted);
      if (isTauri()) invoke('set_tray_session_label', { label }).catch(console.error);
    }, 200);
    return () => {
      if (trayLabelTimerRef.current) clearTimeout(trayLabelTimerRef.current);
    };
  }, [alertsActive, prefs.trayTimer, phase, remainingSeconds, activeSessionType, breakVariant, longBreakStage, activeWorkout]);

  useEffect(() => {
    cancelCountdownRef.current?.();
    cancelCountdownRef.current = null;
    if (!alertsActive || !prefs.countdownSound || phase === 'idle') {
      countdownScheduledForPhaseRef.current = null;
      return;
    }
    if (remainingSeconds > 5) {
      countdownScheduledForPhaseRef.current = null;
      return;
    }
    if (remainingSeconds < 1) return;
    if (countdownScheduledForPhaseRef.current === phaseKey) return;
    countdownScheduledForPhaseRef.current = phaseKey;
    cancelCountdownRef.current = scheduleCountdownBeeps(remainingSeconds, playCountdownTick);
    return () => {
      cancelCountdownRef.current?.();
      cancelCountdownRef.current = null;
    };
  }, [alertsActive, prefs.countdownSound, phase, phaseKey, remainingSeconds]);

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
      const background = takeBackgroundFlowStart();
      if (prefs.sound && !background) playPhaseChangeChime();
      if (prefs.focusWindow && !background && isTauri()) {
        invoke('focus_main_window', { dockBounce: prefs.dockBounce }).catch(console.error);
        requestGoToWorkTab();
      }
      if (prefs.notify && !background && isTauri()) {
        const copy = sessionPhaseNotifyCopy(phase, activeSessionType, breakVariant, longBreakStage);
        if (copy) invoke('notify_session_phase', { title: copy.title, body: copy.body }).catch(console.error);
      }
      return;
    }

    if (leftActive) {
      if (prefs.sound) playPhaseChangeChime();
      if (prefs.focusWindow && isTauri()) {
        invoke('focus_main_window', { dockBounce: prefs.dockBounce }).catch(console.error);
        requestGoToWorkTab();
      }
      if (prefs.notify && isTauri()) {
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
    takeBackgroundFlowStart,
    phaseKey,
    phase,
    activeSessionType,
    breakVariant,
    longBreakStage
  ]);

  return null;
};

export default SessionAlerts;
