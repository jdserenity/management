import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SqlDatabase } from '@mgmt/storage';
import {
  fetchUserData,
  pushUserData,
  extractUserData,
  hydrateDb,
  wrapWithDataSync,
  type UserData
} from './userData';
import { setSyncFetchImpl } from './syncFetch';

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptyData = (): UserData => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: []
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
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
});

// ── pushUserData ──────────────────────────────────────────────────────────────

describe('pushUserData', () => {
  afterEach(() => { setSyncFetchImpl(null); });

  it('calls POST /v1/data with data body', async () => {
    const data = emptyData();
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

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(pushUserData('http://localhost:8787', 'tok', emptyData())).rejects.toThrow('HTTP 500');
    vi.unstubAllGlobals();
  });

  it('uses setSyncFetchImpl when provided', async () => {
    const customFetch = vi.fn().mockResolvedValue({ ok: true });
    setSyncFetchImpl(customFetch as typeof fetch);
    await pushUserData('http://localhost:8787', 'tok', emptyData());
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
    // 10 tables
    expect(selects).toHaveLength(10);
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
  it('executes no statements when data is empty', async () => {
    const db = makeMockDb();
    await hydrateDb(db, emptyData());
    expect(db.calls.filter((c) => c.startsWith('EXEC'))).toHaveLength(0);
  });

  it('upserts one focus_log row', async () => {
    const db = makeMockDb();
    await hydrateDb(db, {
      ...emptyData(),
      focusLog: [{ id: 'f1', session_type: 'pomodoro', completed_at: 1000, duration_minutes: 25, planned_duration_minutes: 25, completion_ratio: 1.0 }]
    });
    const execs = db.calls.filter((c) => c.startsWith('EXEC'));
    expect(execs).toHaveLength(1);
    expect(execs[0]).toContain('focus_log');
  });

  it('upserts nutritionConfig when present', async () => {
    const db = makeMockDb();
    await hydrateDb(db, { ...emptyData(), nutritionConfig: { tdee: 2500, protein: 180, log_day: '2026-06-25' } });
    expect(db.calls.some((c) => c.includes('nutrition_config'))).toBe(true);
  });

  it('skips nutritionConfig when null', async () => {
    const db = makeMockDb();
    await hydrateDb(db, { ...emptyData(), nutritionConfig: null });
    expect(db.calls.filter((c) => c.includes('nutrition_config'))).toHaveLength(0);
  });

  it('upserts multiple tables in one call', async () => {
    const db = makeMockDb();
    await hydrateDb(db, {
      ...emptyData(),
      appKv: [{ key: 'k', value: 'v', updated_at: 1 }],
      streakActivities: [{ id: 'a1', name: 'Run', description: null, frequency: 'daily', weekly_target: null, scheduled_days_json: null, can_fail: 0, archived_at: null, sort_order: 0 }]
    });
    const execs = db.calls.filter((c) => c.startsWith('EXEC'));
    expect(execs).toHaveLength(2);
  });
});

// ── wrapWithDataSync ──────────────────────────────────────────────────────────

describe('wrapWithDataSync', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it('is a pass-through when serverUrl is missing', async () => {
    const db = makeMockDb();
    const wrapped = wrapWithDataSync(db, undefined, 'tok');
    await wrapped.execute('INSERT INTO foo VALUES (?)', [1]);
    expect(db.execute).toHaveBeenCalledWith('INSERT INTO foo VALUES (?)', [1]);
    expect(wrapped).toBe(db);
  });

  it('is a pass-through when token is missing', async () => {
    const db = makeMockDb();
    const wrapped = wrapWithDataSync(db, 'http://localhost:8787', undefined);
    expect(wrapped).toBe(db);
  });

  it('schedules a debounced push after execute', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    const db = makeMockDb();
    const wrapped = wrapWithDataSync(db, 'http://localhost:8787', 'tok', 500);
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
    const db = makeMockDb();
    const wrapped = wrapWithDataSync(db, 'http://localhost:8787', 'tok', 500);
    await wrapped.execute('INSERT INTO a VALUES (?)', [1]);
    await wrapped.execute('INSERT INTO b VALUES (?)', [2]);
    await wrapped.execute('INSERT INTO c VALUES (?)', [3]);
    await vi.advanceTimersByTimeAsync(600);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('calls onPushError when push fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Load failed'));
    vi.stubGlobal('fetch', mockFetch);
    const onPushError = vi.fn();
    const db = makeMockDb();
    const wrapped = wrapWithDataSync(db, 'http://localhost:8787', 'tok', 500, onPushError);
    await wrapped.execute('INSERT INTO foo VALUES (?)', [1]);
    await vi.advanceTimersByTimeAsync(600);
    expect(onPushError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Load failed') }));
    vi.unstubAllGlobals();
  });
});
