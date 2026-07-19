import { describe, expect, it } from 'vitest';
import type { PersistedFlowState } from '@mgmt/core';
import { createActiveFlowDocument } from '@mgmt/sync';
import { createSyncApp } from './app';
import { MemoryActiveFlowStore } from './store';
import { openServerDb, seedOwnerUser } from './db';
import { SqliteDataStore } from './dataStore';

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

describe('server', () => {
  it('stores and returns active flow with bearer auth', async () => {
    const app = createSyncApp(new MemoryActiveFlowStore(), null, 'test-token');
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
    const app = createSyncApp(new MemoryActiveFlowStore(), null, 'test-token');
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

  it('root explains this host is the sync API, not the phone app', async () => {
    const app = createSyncApp(new MemoryActiveFlowStore(), null, 'test-token');
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      service: 'mgmt-server',
      health: '/health',
      companion: 'https://mgmt-companion.pages.dev'
    });
  });

  it('applies row patch without wiping other tables', async () => {
    const db = openServerDb(':memory:');
    seedOwnerUser(db, 'owner');
    const dataStore = new SqliteDataStore(db);
    dataStore.putData('owner', {
      focusLog: [], workoutLog: [],
      appKv: [{ key: 'keep', value: 'v1', updated_at: 1 }],
      nutritionConfig: null, nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
      streakActivities: [], streakLogCells: [], streakActivityMeta: [],
      waterConfig: null,
      waterEntries: [{ id: 'w1', log_day: '2026-06-28', label: 'Bottle', ml: 500, count: 1, updated_at: '2026-06-28T10:00:00Z', deleted: 0 }]
    });
    const app = createSyncApp(new MemoryActiveFlowStore(), dataStore, 'test-token');
    const res = await app.request('/v1/data/patch', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        rowPatch: {
          appKv: {
            upserts: [{ key: 'keep', value: 'v2', updated_at: 2 }]
          }
        }
      })
    });
    expect(res.status).toBe(200);
    const data = dataStore.getData('owner');
    expect(data.appKv[0]?.value).toBe('v2');
    expect(data.waterEntries).toHaveLength(1);
    db.close();
  });
});
