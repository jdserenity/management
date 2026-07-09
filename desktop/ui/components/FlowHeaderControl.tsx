import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSession } from '@/context/SessionContext';
import { flowStatusLabel } from '@/lib/sessionAlertLabels';
import { isTauri } from '@/lib/isTauri';
import { cn } from '@/lib/utils';

type FlowHeaderControlProps = {
  onGoToWork: () => void;
  compact?: boolean;
};

const FlowHeaderControl = ({ onGoToWork, compact }: FlowHeaderControlProps) => {
  const { phase, activeSessionType, breakVariant, longBreakStage, activeWorkout, startFlow } = useSession();
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startFlowRef = useRef(startFlow);
  startFlowRef.current = startFlow;
  const flowActive = phase !== 'idle';
  const hasActiveWorkout = Boolean(activeWorkout);
  const statusLabel = flowActive
    ? flowStatusLabel(phase, activeSessionType, breakVariant, longBreakStage, hasActiveWorkout)
    : null;

  useEffect(() => {
    if (!isTauri()) return;
    invoke('set_tray_flow_active', { active: flowActive }).catch(console.error);
  }, [flowActive]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listen('tray-start-focus-flow', () => {
      if (cancelled) return;
      if (phaseRef.current === 'idle') startFlowRef.current('pomodoro', { background: true });
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    }).catch(console.error);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleClick = () => {
    if (!flowActive) {
      startFlow('pomodoro');
      return;
    }
    onGoToWork();
  };

  return (
    <button
      type="button"
      className={cn('plugin-btn shrink-0', flowActive ? '' : 'plugin-btn-primary', compact && 'text-xs px-2.5')}
      onClick={handleClick}
      aria-label={flowActive ? `Open work tab — ${statusLabel}` : 'Start focus flow'}
    >
      {flowActive ? statusLabel : '▶ Start flow'}
    </button>
  );
};

export default FlowHeaderControl;
