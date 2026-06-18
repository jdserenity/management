import { describe, expect, it } from 'vitest';
import type { PersistedFlowState } from '@mgmt/core';
import { createActiveFlowDocument } from '@mgmt/sync';
import { createSyncApp } from './app';
import { MemoryActiveFlowStore } from './store';

const sampleFlow = (): PersistedFlowState => ({
  version: 1,
  phase: 'break',
  breakVariant: 'short',
  longBreakStage: null,
  activeSessionType: 'pomodoro',
  remainingSeconds: 120,
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

describe('sync-api', () => {
  it('stores and returns active flow with bearer auth', async () => {
    const app = createSyncApp(new MemoryActiveFlowStore(), 'test-token');
    const unauthorized = await app.request('/v1/active-flow');
    expect(unauthorized.status).toBe(401);

    const empty = await app.request('/v1/active-flow', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ doc: null });

    const doc = createActiveFlowDocument(sampleFlow(), 'phone', 88_000, 100);
    const put = await app.request('/v1/active-flow', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ doc })
    });
    expect(put.status).toBe(200);
    const saved = (await put.json()) as { doc: { phaseEndsAtMs: number } };
    expect(saved.doc.phaseEndsAtMs).toBe(88_000);

    const get = await app.request('/v1/active-flow', {
      headers: { Authorization: 'Bearer test-token' }
    });
    const row = (await get.json()) as { doc: { leaderDeviceId: string } };
    expect(row.doc.leaderDeviceId).toBe('phone');
  });

  it('allows CORS preflight without bearer token', async () => {
    const app = createSyncApp(new MemoryActiveFlowStore(), 'test-token');
    const res = await app.request('/v1/active-flow', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    });
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
});
