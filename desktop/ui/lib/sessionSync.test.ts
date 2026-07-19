import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActiveFlowDocument } from '@mgmt/sync';
import type { PersistedFlowState } from '@mgmt/core';
import { applyRemoteActiveFlow, isRemoteActiveFlow, isSyncViewer, shouldFollowRemoteFlowClear, shouldPollDesktopActiveFlow, syncLeaderDeviceIdFromDoc } from './sessionSync';

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('clears leader when remote active flow is cleared', () => {
    const doc = createActiveFlowDocument(flow(), 'phone', Date.now() + 60_000);
    expect(syncLeaderDeviceIdFromDoc(doc)).toBe('phone');
    expect(syncLeaderDeviceIdFromDoc(null)).toBeNull();
    expect(isSyncViewer(syncLeaderDeviceIdFromDoc(null), 'desktop')).toBe(false);
  });

  it('resets viewer desktop state when remote flow clears', () => {
    expect(shouldFollowRemoteFlowClear('phone', 'desktop', 'break')).toBe(true);
    expect(shouldFollowRemoteFlowClear('desktop', 'desktop', 'break')).toBe(false);
    expect(shouldFollowRemoteFlowClear('phone', 'desktop', 'idle')).toBe(false);
  });

  it('polls desktop active flow only while visible', () => {
    vi.stubGlobal('document', { visibilityState: 'visible' });
    expect(shouldPollDesktopActiveFlow()).toBe(true);
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    expect(shouldPollDesktopActiveFlow()).toBe(false);
  });

  it('allows desktop active-flow polling outside browser contexts', () => {
    vi.stubGlobal('document', undefined);
    expect(shouldPollDesktopActiveFlow()).toBe(true);
  });
});
