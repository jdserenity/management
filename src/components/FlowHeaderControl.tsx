import { useEffect, useRef } from 'react';
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
  const flowActive = phase !== 'idle';
  const hasActiveWorkout = Boolean(activeWorkout);
  const statusLabel = flowActive
    ? flowStatusLabel(phase, activeSessionType, breakVariant, longBreakStage, hasActiveWorkout)
    : null;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listen('tray-start-focus-flow', () => {
      if (cancelled) return;
      if (phaseRef.current === 'idle') startFlow('pomodoro');
      onGoToWork();
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    }).catch(console.error);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [startFlow, onGoToWork]);

  const handleClick = () => {
    if (!flowActive) startFlow('pomodoro');
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
