import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  resolveBreakTimerEnd,
  shouldAttemptBreakAdvance,
  shouldSkipBreakAdvanceForDoc
} from '../lib/breakSync';
import { isActiveExerciseBreak, markWorkoutCompletedInFlow, updateBreakExerciseAmountInFlow } from '@mgmt/core';
import { createActiveFlowDocument, liveRemainingSeconds, type ActiveFlowDocument, type SyncClient } from '@mgmt/sync';

export interface CompanionSessionValue {
  activeFlow: ActiveFlowDocument | null;
  remainingSeconds: number;
  phase: ActiveFlowDocument['flow']['phase'];
  syncStatus: ReturnType<SyncClient['getStatus']>;
  syncDetail: string | null;
  deviceId: string;
  isLeader: boolean;
  showExercisePanel: boolean;
  completeWorkout: () => void;
  updateExerciseAmount: (index: number, amount: number) => void;
}

const CompanionSessionContext = createContext<CompanionSessionValue | null>(null);

export const CompanionSessionProvider = ({
  client,
  children
}: {
  client: SyncClient;
  children: ReactNode;
}) => {
  const [activeFlow, setActiveFlow] = useState<ActiveFlowDocument | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [syncStatus, setSyncStatus] = useState(client.getStatus());
  const [syncDetail, setSyncDetail] = useState<string | null>(client.getLastError?.() ?? null);
  const [isLeader, setIsLeader] = useState(false);
  const activeFlowRef = useRef<ActiveFlowDocument | null>(null);
  const phaseEndsAtMsRef = useRef(0);
  const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPublishedAtMsRef = useRef(0);
  const lastBreakAdvancedAtMsRef = useRef(0);

  activeFlowRef.current = activeFlow;

  const publishFlow = useCallback(
    (flow: ActiveFlowDocument['flow'] | null, phaseEndsAtMs: number) => {
      const doc = flow ? createActiveFlowDocument(flow, client.deviceId, phaseEndsAtMs) : null;
      lastPublishedAtMsRef.current = doc?.updatedAtMs ?? Date.now();
      void client.publishActiveFlow(doc).catch((error) => {
        console.error('Failed to publish companion flow:', error);
      });
      if (doc) {
        setActiveFlow(doc);
        phaseEndsAtMsRef.current = doc.phaseEndsAtMs;
        setIsLeader(true);
      } else {
        setActiveFlow(null);
        setIsLeader(false);
        lastBreakAdvancedAtMsRef.current = 0;
      }
    },
    [client]
  );

  const tryAdvanceBreakAtZero = useCallback(() => {
    const doc = activeFlowRef.current;
    if (!doc || doc.flow.phase !== 'break') return;
    if (liveRemainingSeconds(doc) > 0) return;
    if (shouldSkipBreakAdvanceForDoc(doc.updatedAtMs, lastBreakAdvancedAtMsRef.current)) return;
    lastBreakAdvancedAtMsRef.current = doc.updatedAtMs;
    const action = resolveBreakTimerEnd(doc.flow);
    if (action.kind === 'clear') {
      publishFlow(null, 0);
      return;
    }
    publishFlow(action.flow, action.phaseEndsAtMs);
  }, [publishFlow]);

  const schedulePublish = useCallback(
    (flow: ActiveFlowDocument['flow'], phaseEndsAtMs: number) => {
      if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
      publishTimerRef.current = setTimeout(() => publishFlow(flow, phaseEndsAtMs), 300);
    },
    [publishFlow]
  );

  useEffect(() => {
    return client.subscribeActiveFlow((doc) => {
      setSyncStatus(client.getStatus());
      setSyncDetail(client.getLastError?.() ?? null);
      if (!doc) {
        setActiveFlow(null);
        setIsLeader(false);
        return;
      }
      if (doc.updatedAtMs < lastPublishedAtMsRef.current) return;
      setActiveFlow(doc);
      phaseEndsAtMsRef.current = doc.phaseEndsAtMs;
      const leading = doc.leaderDeviceId === client.deviceId;
      setIsLeader(leading);
      const f = doc.flow;
      if (
        f.phase === 'break' &&
        isActiveExerciseBreak(f.phase, f.breakVariant, f.longBreakStage, f.activeWorkout) &&
        !leading
      ) {
        void client.publishActiveFlow(createActiveFlowDocument(f, client.deviceId, doc.phaseEndsAtMs));
        lastPublishedAtMsRef.current = Date.now();
        setIsLeader(true);
      }
    });
  }, [client]);

  useEffect(() => {
    if (!activeFlow || activeFlow.flow.phase === 'idle') {
      setRemainingSeconds(0);
      return;
    }
    const tick = () => setRemainingSeconds(liveRemainingSeconds(activeFlow));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeFlow]);

  useEffect(() => {
    if (!shouldAttemptBreakAdvance(isLeader, activeFlow?.flow.phase ?? 'idle', remainingSeconds)) return;
    tryAdvanceBreakAtZero();
  }, [isLeader, activeFlow, remainingSeconds, tryAdvanceBreakAtZero]);

  const completeWorkout = useCallback(() => {
    const doc = activeFlowRef.current;
    if (!doc || doc.flow.workoutLogged) return;
    const nextFlow = markWorkoutCompletedInFlow(doc.flow);
    schedulePublish(nextFlow, phaseEndsAtMsRef.current);
  }, [schedulePublish]);

  const updateExerciseAmount = useCallback(
    (index: number, amount: number) => {
      const doc = activeFlowRef.current;
      if (!doc || !isLeader) return;
      const nextFlow = updateBreakExerciseAmountInFlow(doc.flow, index, amount);
      schedulePublish(nextFlow, phaseEndsAtMsRef.current);
    },
    [isLeader, schedulePublish]
  );

  const flow = activeFlow?.flow ?? null;
  const showExercisePanel = flow
    ? isActiveExerciseBreak(flow.phase, flow.breakVariant, flow.longBreakStage, flow.activeWorkout)
    : false;

  const value = useMemo(
    (): CompanionSessionValue => ({
      activeFlow,
      remainingSeconds,
      phase: flow?.phase ?? 'idle',
      syncStatus,
      syncDetail,
      deviceId: client.deviceId,
      isLeader,
      showExercisePanel,
      completeWorkout,
      updateExerciseAmount
    }),
    [activeFlow, remainingSeconds, flow?.phase, syncStatus, syncDetail, client.deviceId, isLeader, showExercisePanel, completeWorkout, updateExerciseAmount]
  );

  return <CompanionSessionContext.Provider value={value}>{children}</CompanionSessionContext.Provider>;
};

export const useCompanionSession = (): CompanionSessionValue => {
  const ctx = useContext(CompanionSessionContext);
  if (!ctx) throw new Error('useCompanionSession must be used within CompanionSessionProvider');
  return ctx;
};
