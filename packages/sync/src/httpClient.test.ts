import { describe, expect, it, vi } from 'vitest';
import type { PersistedFlowState } from '@mgmt/core';
import { createActiveFlowDocument } from './flowSync';
import { HttpSyncClient } from './httpClient';
import type { ActiveFlowDocument } from './types';

const sampleFlow = (): PersistedFlowState => ({
  version: 1,
  phase: 'break',
  breakVariant: 'short',
  longBreakStage: null,
  activeSessionType: 'pomodoro',
  remainingSeconds: 60,
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

describe('HttpSyncClient', () => {
  it('pulls active flow on subscribe', async () => {
    const doc = createActiveFlowDocument(sampleFlow(), 'remote', 99_000);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ doc })
    })) as unknown as typeof fetch;
    const client = new HttpSyncClient({
      baseUrl: 'http://localhost:8787',
      token: 'test',
      deviceId: 'viewer-1',
      pollIntervalMs: 60_000,
      fetchImpl
    });
    const seen: Array<ActiveFlowDocument | null> = [];
    client.subscribeActiveFlow((row) => seen.push(row));
    await vi.waitFor(() => {
      expect(seen.some((row) => row?.phaseEndsAtMs === 99_000)).toBe(true);
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:8787/v1/active-flow',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test' }) })
    );
  });

  it('publishes active flow with bearer token', async () => {
    const doc = createActiveFlowDocument(sampleFlow(), 'leader', 50_000);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ doc })
    })) as unknown as typeof fetch;
    const client = new HttpSyncClient({
      baseUrl: 'http://localhost:8787',
      token: 'secret',
      role: 'leader',
      deviceId: 'leader-1',
      fetchImpl
    });
    await client.publishActiveFlow(doc);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
    const body = JSON.parse(String(init.body)) as { doc: { leaderDeviceId: string } };
    expect(body.doc.leaderDeviceId).toBe('leader-1');
  });
});
