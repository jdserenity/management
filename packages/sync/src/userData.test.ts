import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SqlDatabase } from '@mgmt/storage';
import {
  fetchUserData,
  pushUserData,
  extractUserData,
  hydrateDb,
  hydrateDbFromServer,
  wrapWithDataSync,
  type UserData
} from './userData';
import { setSyncFetchImpl } from './syncFetch';

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptyData = (): UserData => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: []
});

const streakRow = (overrides: Partial<UserData['streakActivities'][0]> = {}) => ({
  id: 'a1', name: 'Run', description: null, frequency: 'daily', weekly_target: null,
  scheduled_days_json: null, can_fail: 0, archived_at: null, sort_order: 0,
  extra_calories: null, extra_protein: null, extra_water_ml: null,
  ...overrides
});

const makeMockDb = (selectResults: Record<string, unknown[]> = {}): SqlDatabase & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    select: vi.fn(async <T>(q: string): Promise<T> => {
      calls.push(`SELECT:${q.slice(0, 40)}`);
      return (selectResults[q] ?? []) as T;
    }),
    execute: vi.fn(async (q: string, _bind?: unknown[]) => {
      calls.push(`EXEC:${q.slice(0, 40)}`);
      return { lastInsertId: 1, rowsAffected: 1 };
    })
  };
};

const makeMockDbWithSyncData = (): SqlDatabase & { calls: string[] } =>
  makeMockDb({ 'SELECT key,value,updated_at FROM app_kv': [{ key: 'k', value: 'v', updated_at: 1 }] });

// ── fetchUserData ─────────────────────────────────────────────────────────────

describe('fetchUserData', () => {
  it('calls GET /v1/data with bearer auth and returns data', async () => {
    const data = emptyData();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data })
    });
    vi.stubGlobal('fetch', mockFetch);
    const result = await fetchUserData('http://localhost:8787', 'tok');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8787/v1/data',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) })
    );
    expect(result).toEqual(data);
    vi.unstubAllGlobals();
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'unauthorized' }));
    await expect(fetchUserData('http://localhost:8787', 'bad')).rejects.toThrow('HTTP 401');
    vi.unstubAllGlobals();
  });

  it('strips trailing slash from base URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: emptyData() }) });
    vi.stubGlobal('fetch', mockFetch);
    await fetchUserData('http://localhost:8787/', 'tok');
    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8787/v1/data');
    vi.unstubAllGlobals();
  });

  it('normalizes bare host:port to http://', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: emptyData() }) });
    vi.stubGlobal('fetch', mockFetch);
    await fetchUserData('100.93.97.83:8787', 'tok');
    expect(mockFetch.mock.calls[0][0]).toBe('http://100.93.97.83:8787/v1/data');
    vi.unstubAllGlobals();
  });
});

// ── pushUserData ──────────────────────────────────────────────────────────────

describe('pushUserData', () => {
  afterEach(() => { setSyncFetchImpl(null); });

  const sampleData = (): UserData => ({
    ...emptyData(),
    appKv: [{ key: 'k', value: 'v', updated_at: 1 }]
  });

  it('calls POST /v1/data with data body', async () => {
    const data = sampleData();
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    await pushUserData('http://localhost:8787', 'tok', data);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8787/v1/data',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ data })
      })
    );
    vi.unstubAllGlobals();
  });

  it('skips POST when snapshot is empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    await pushUserData('http://localhost:8787', 'tok', emptyData());
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Error', text: async () => 'server error' }));
    await expect(pushUserData('http://localhost:8787', 'tok', sampleData())).rejects.toThrow('HTTP 500');
    vi.unstubAllGlobals();
  });

  it('uses setSyncFetchImpl when provided', async () => {
    const customFetch = vi.fn().mockResolvedValue({ ok: true });
    setSyncFetchImpl(customFetch as typeof fetch);
    await pushUserData('http://localhost:8787', 'tok', sampleData());
    expect(customFetch).toHaveBeenCalledWith(
      'http://localhost:8787/v1/data',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

// ── extractUserData ───────────────────────────────────────────────────────────

describe('extractUserData', () => {
  it('issues a SELECT for every data table', async () => {
    const db = makeMockDb();
    await extractUserData(db);
    const selects = db.calls.filter((c) => c.startsWith('SELECT:'));
    expect(selects).toHaveLength(12);
  });

  it('returns nutritionConfig as null when table is empty', async () => {
    const db = makeMockDb();
    const result = await extractUserData(db);
    expect(result.nutritionConfig).toBeNull();
  });

  it('returns nutritionConfig row when present', async () => {
    const nc = { tdee: 2000, protein: 150, log_day: '2026-06-25' };
    const q = 'SELECT tdee,protein,log_day FROM nutrition_config WHERE id=1';
    const db = makeMockDb({ [q]: [nc] });
    const result = await extractUserData(db);
    expect(result.nutritionConfig).toEqual(nc);
  });
});

// ── hydrateDb ────────────────────────────────────────────────────────────────

describe('hydrateDb', () => {
  it('clears synced tables when data is empty', async () => {
    const db = makeMockDb();
    await hydrateDb(db, emptyData());
    const execs = db.calls.filter((c) => c.startsWith('EXEC'));
    expect(execs.some((c) => c.includes('DELETE FROM streak_activities'))).toBe(true);
    expect(execs.filter((c) => c.includes('INSERT INTO'))).toHaveLength(0);
  });

  it('replaces one focus_log row', async () => {
    const db = makeMockDb();
    await hydrateDb(db, {
      ...emptyData(),
      focusLog: [{ id: 'f1', session_type: 'pomodoro', completed_at: 1000, duration_minutes: 25, planned_duration_minutes: 25, completion_ratio: 1.0 }]
    });
    const execs = db.calls.filter((c) => c.startsWith('EXEC'));
    expect(execs.some((c) => c.includes('DELETE FROM focus_log'))).toBe(true);
    expect(execs.some((c) => c.includes('INSERT INTO focus_log'))).toBe(true);
  });

  it('upserts nutritionConfig when present', async () => {
    const db = makeMockDb();
    await hydrateDb(db, { ...emptyData(), nutritionConfig: { tdee: 2500, protein: 180, log_day: '2026-06-25' } });
    expect(db.calls.some((c) => c.includes('nutrition_config'))).toBe(true);
  });

  it('clears nutritionConfig when null', async () => {
    const db = makeMockDb();
    await hydrateDb(db, { ...emptyData(), nutritionConfig: null });
    expect(db.calls.some((c) => c.includes('DELETE FROM nutrition_config'))).toBe(true);
    expect(db.calls.some((c) => c.includes('INSERT INTO nutrition_config'))).toBe(false);
  });

  it('replaces streak activities removed from the snapshot', async () => {
    const row = streakRow();
    const db = makeMockDb();
    await hydrateDb(db, { ...emptyData(), streakActivities: [row] });
    await hydrateDb(db, { ...emptyData(), streakActivities: [] });
    const deletes = db.calls.filter((c) => c.includes('DELETE FROM streak_activities'));
    expect(deletes.length).toBeGreaterThanOrEqual(2);
    const inserts = db.calls.filter((c) => c.includes('INSERT INTO streak_activities'));
    expect(inserts).toHaveLength(1);
  });

  it('replaces multiple tables in one call', async () => {
    const db = makeMockDb();
    await hydrateDb(db, {
      ...emptyData(),
      appKv: [{ key: 'k', value: 'v', updated_at: 1 }],
      streakActivities: [streakRow({ id: 'a1', name: 'Run' })]
    });
    const execs = db.calls.filter((c) => c.startsWith('EXEC'));
    expect(execs.some((c) => c.includes('INSERT INTO app_kv'))).toBe(true);
    expect(execs.some((c) => c.includes('INSERT INTO streak_activities'))).toBe(true);
  });

  it('round-trips water config and entries', async () => {
    const db = makeMockDb();
    await hydrateDb(db, {
      ...emptyData(),
      waterConfig: { target_ml: 3000, log_day: '2026-06-28' },
      waterEntries: [{ id: 'w1', log_day: '2026-06-28', label: 'Glass', ml: 250, count: 2, updated_at: '2026-06-28T12:00:00Z', deleted: 0 }]
    });
    expect(db.calls.some((c) => c.includes('water_config'))).toBe(true);
    expect(db.calls.some((c) => c.includes('INSERT INTO water_entries'))).toBe(true);
  });

  it('persists streak cross-log fields', async () => {
    const db = makeMockDb();
    await hydrateDb(db, {
      ...emptyData(),
      streakActivities: [streakRow({ extra_calories: 100, extra_protein: 20, extra_water_ml: 500 })]
    });
    expect(db.calls.some((c) => c.includes('INSERT INTO streak_activities'))).toBe(true);
  });
});

// ── hydrateDbFromServer ───────────────────────────────────────────────────────

describe('hydrateDbFromServer', () => {
  it('keeps local data when server snapshot is empty', async () => {
    const db = makeMockDb();
    const local = { ...emptyData(), appKv: [{ key: 'k', value: 'v', updated_at: 1 }] };
    const result = await hydrateDbFromServer(db, emptyData(), local);
    expect(result).toBe('kept-local');
    expect(db.calls.some((c) => c.includes('DELETE FROM'))).toBe(false);
  });

  it('hydrates when server has data', async () => {
    const db = makeMockDb();
    const server = { ...emptyData(), appKv: [{ key: 'k', value: 'v', updated_at: 1 }] };
    const result = await hydrateDbFromServer(db, server, emptyData());
    expect(result).toBe('hydrated');
    expect(db.calls.some((c) => c.includes('DELETE FROM app_kv'))).toBe(true);
  });
});

// ── wrapWithDataSync ──────────────────────────────────────────────────────────

describe('wrapWithDataSync', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('is a pass-through when serverUrl is missing', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    const db = makeMockDb();
    const wrapped = wrapWithDataSync(db, () => ({ token: 'tok' }));
    await wrapped.execute('INSERT INTO foo VALUES (?)', [1]);
    await vi.advanceTimersByTimeAsync(600);
    expect(db.execute).toHaveBeenCalledWith('INSERT INTO foo VALUES (?)', [1]);
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('is a pass-through when token is missing', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    const db = makeMockDb();
    const wrapped = wrapWithDataSync(db, () => ({ serverUrl: 'http://localhost:8787' }));
    await wrapped.execute('INSERT INTO foo VALUES (?)', [1]);
    await vi.advanceTimersByTimeAsync(600);
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('schedules a debounced push after execute', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    const db = makeMockDbWithSyncData();
    const wrapped = wrapWithDataSync(db, () => ({ serverUrl: 'http://localhost:8787', token: 'tok' }), 500);
    await wrapped.execute('INSERT INTO foo VALUES (?)', [1]);
    expect(mockFetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    // extractUserData runs first (GET-like selects via db.select), then push
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8787/v1/data',
      expect.objectContaining({ method: 'POST' })
    );
    vi.unstubAllGlobals();
  });

  it('debounces multiple rapid writes into one push', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    const db = makeMockDbWithSyncData();
    const wrapped = wrapWithDataSync(db, () => ({ serverUrl: 'http://localhost:8787', token: 'tok' }), 500);
    await wrapped.execute('INSERT INTO a VALUES (?)', [1]);
    await wrapped.execute('INSERT INTO b VALUES (?)', [2]);
    await wrapped.execute('INSERT INTO c VALUES (?)', [3]);
    await vi.advanceTimersByTimeAsync(600);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('does not push when extracted snapshot is empty', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    const db = makeMockDb();
    const wrapped = wrapWithDataSync(db, () => ({ serverUrl: 'http://localhost:8787', token: 'tok' }), 500);
    await wrapped.execute('DELETE FROM foo', []);
    await vi.advanceTimersByTimeAsync(600);
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('calls onPushError when push fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Load failed'));
    vi.stubGlobal('fetch', mockFetch);
    const onPushError = vi.fn();
    const db = makeMockDbWithSyncData();
    const wrapped = wrapWithDataSync(db, () => ({ serverUrl: 'http://localhost:8787', token: 'tok' }), 500, onPushError);
    await wrapped.execute('INSERT INTO foo VALUES (?)', [1]);
    await vi.advanceTimersByTimeAsync(600);
    expect(onPushError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Load failed') }));
    vi.unstubAllGlobals();
  });

  it('waits for beforePush before pushing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    const db = makeMockDbWithSyncData();
    const callOrder: string[] = [];
    const beforePush = vi.fn(async () => { callOrder.push('beforePush'); });
    const wrapped = wrapWithDataSync(
      db,
      () => ({ serverUrl: 'http://localhost:8787', token: 'tok' }),
      500,
      undefined,
      beforePush
    );
    mockFetch.mockImplementation(async () => { callOrder.push('fetch'); return { ok: true }; });
    await wrapped.execute('INSERT INTO foo VALUES (?)', [1]);
    await vi.advanceTimersByTimeAsync(600);
    expect(beforePush).toHaveBeenCalled();
    expect(callOrder).toEqual(['beforePush', 'fetch']);
    vi.unstubAllGlobals();
  });
});
