import { describe, expect, it } from 'vitest';
import { createActiveFlowDocument } from '@mgmt/sync';
import type { PersistedFlowState } from '@mgmt/core';
import { applyRemoteActiveFlow, isRemoteActiveFlow, isSyncViewer } from './sessionSync';

const flow = (): PersistedFlowState => ({
  version: 1,
  phase: 'break',
  breakVariant: 'short',
  longBreakStage: null,
  activeSessionType: 'pomodoro',
  remainingSeconds: 300,
  phasePlannedSeconds: 300,
  phaseStartedAtMs: 1,
  nextSessionType: 'pomodoro',
  activeWorkout: null,
  workoutLogged: false,
  runStartedAt: 1,
  runPomodoros: 1,
  runDeepWork: 0,
  runExerciseTotals: {},
  pomodoroPosture: 'sitting',
  lastPomodoroPosture: null
});

describe('sessionSync', () => {
  it('flags remote leader documents', () => {
    const doc = createActiveFlowDocument(flow(), 'phone', Date.now() + 60_000);
    expect(isRemoteActiveFlow(doc, 'desktop')).toBe(true);
    expect(isRemoteActiveFlow(doc, 'phone')).toBe(false);
  });

  it('applies live remaining seconds from phase end', () => {
    const endsAt = Date.now() + 45_000;
    const doc = createActiveFlowDocument(flow(), 'phone', endsAt);
    const applied = applyRemoteActiveFlow(doc);
    expect(applied.flow.remainingSeconds).toBeGreaterThan(40);
    expect(applied.flow.remainingSeconds).toBeLessThanOrEqual(45);
  });

  it('flags sync viewer when another device leads', () => {
    expect(isSyncViewer('phone', 'desktop')).toBe(true);
    expect(isSyncViewer('desktop', 'desktop')).toBe(false);
  });
});
