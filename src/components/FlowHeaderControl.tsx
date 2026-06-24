import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Button } from '@/components/ui/button';
import { useSession } from '@/context/SessionContext';
import { flowStatusLabel } from '@/lib/sessionAlertLabels';

type FlowHeaderControlProps = {
  onGoToWork: () => void;
};

const FlowHeaderControl = ({ onGoToWork }: FlowHeaderControlProps) => {
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
    invoke('set_tray_flow_active', { active: flowActive }).catch(console.error);
  }, [flowActive]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listen('tray-start-focus-flow', () => {
      if (cancelled) return;
      if (phaseRef.current === 'idle') startFlowRef.current('pomodoro');
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
    <Button
      type="button"
      variant={flowActive ? 'secondary' : 'default'}
      size="sm"
      className="ml-auto shrink-0 gap-1.5 text-xs sm:text-sm"
      onClick={handleClick}
      aria-label={flowActive ? `Open work tab — ${statusLabel}` : 'Start focus flow'}
    >
      {flowActive ? statusLabel : '▶ Start flow'}
    </Button>
  );
};

export default FlowHeaderControl;
