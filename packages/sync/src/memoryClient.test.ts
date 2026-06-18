import { describe, expect, it } from 'vitest';
import type { PersistedFlowState } from '@mgmt/core';
import { createActiveFlowDocument, liveRemainingSeconds } from './flowSync';
import { createMemorySyncPair } from './memoryClient';

const idleFlow = (): PersistedFlowState => ({
  version: 1,
  phase: 'break',
  breakVariant: 'short',
  longBreakStage: null,
  activeSessionType: 'pomodoro',
  remainingSeconds: 300,
  phasePlannedSeconds: 300,
  phaseStartedAtMs: 1_000,
  nextSessionType: 'pomodoro',
  activeWorkout: {
    id: 'mixed-break',
    name: 'Break moves',
    estimatedMinutes: 5,
    exercises: [{ id: 'push-ups', name: 'Push-ups', amount: 10, unit: 'reps' }]
  },
  workoutLogged: false,
  runStartedAt: 1_000,
  runPomodoros: 1,
  runDeepWork: 0,
  runExerciseTotals: {},
  pomodoroPosture: 'sitting',
  lastPomodoroPosture: 'sitting'
});

describe('flowSync', () => {
  it('builds an active flow document with phase end time', () => {
    const doc = createActiveFlowDocument(idleFlow(), 'phone-1', 50_000, 20_000);
    expect(doc.leaderDeviceId).toBe('phone-1');
    expect(doc.phaseEndsAtMs).toBe(50_000);
    expect(liveRemainingSeconds(doc, 35_000)).toBe(15);
  });
});

describe('MemorySyncClient', () => {
  it('publishes from leader and notifies viewer', async () => {
    const { leader, viewer } = createMemorySyncPair('test-bus');
    const seen: number[] = [];
    viewer.subscribeActiveFlow((doc) => {
      if (doc) seen.push(doc.phaseEndsAtMs);
    });
    const doc = createActiveFlowDocument(idleFlow(), leader.deviceId, 99_000);
    await leader.publishActiveFlow(doc);
    expect(seen).toEqual([99_000]);
  });

  it('allows viewer role to publish on the memory bus', async () => {
    const { viewer } = createMemorySyncPair('test-bus-viewer-publish');
    const doc = createActiveFlowDocument(idleFlow(), viewer.deviceId);
    await expect(viewer.publishActiveFlow(doc)).resolves.toBeUndefined();
  });
});
