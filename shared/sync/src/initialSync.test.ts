import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./userData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./userData')>();
  return {
    ...actual,
    extractUserData: vi.fn(),
    fetchUserData: vi.fn(),
    hydrateDb: vi.fn(),
    hydrateDbFromServer: vi.fn(),
    pushUserDataDiff: vi.fn()
  };
});

vi.mock('./syncOutbox', () => ({ drainSyncOutbox: vi.fn().mockResolvedValue({ ok: true, drained: 0 }) }));
vi.mock('./mergeUserData', () => ({ mergeUserData: vi.fn() }));
vi.mock('./dataSyncEvents', () => ({ dispatchDataSyncRefresh: vi.fn() }));

import { dispatchDataSyncRefresh } from './dataSyncEvents';
import { mergeUserData } from './mergeUserData';
import { extractUserData, fetchUserData, hydrateDb, hydrateDbFromServer, pushUserDataDiff } from './userData';
import { pullAndMergeUserData, resetSyncWarningForTests, runBidirectionalInitialSync } from './initialSync';

const empty = () => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: [], syncTombstones: []
});

const db = { select: vi.fn(), execute: vi.fn() };

describe('runBidirectionalInitialSync', () => {
  beforeEach(() => {
    resetSyncWarningForTests();
    vi.mocked(extractUserData).mockResolvedValue(empty());
    vi.mocked(fetchUserData).mockResolvedValue(empty());
    vi.mocked(hydrateDbFromServer).mockResolvedValue('hydrated');
    vi.mocked(hydrateDb).mockResolvedValue(undefined);
    vi.mocked(pushUserDataDiff).mockResolvedValue(undefined);
    vi.mocked(mergeUserData).mockReturnValue(empty());
  });

  it('skips when creds missing', async () => {
    const result = await runBidirectionalInitialSync({ logLabel: 'test', db, serverUrl: undefined, serverToken: undefined });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no-creds');
  });

  it('pulls when local empty and server has data', async () => {
    const server = { ...empty(), streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'success', updated_at: '2026-06-28T12:00:00.000Z' }] };
    vi.mocked(fetchUserData).mockResolvedValue(server);
    const result = await runBidirectionalInitialSync({ logLabel: 'test', db, serverUrl: 'https://mgmt.levier.cc', serverToken: 'tok' });
    expect(result.pullOk).toBe(true);
    expect(hydrateDbFromServer).toHaveBeenCalled();
    expect(pushUserDataDiff).not.toHaveBeenCalled();
    expect(dispatchDataSyncRefresh).toHaveBeenCalled();
  });

  it('merges when both sides have data', async () => {
    const local = { ...empty(), appKv: [{ key: 'k', value: 'v', updated_at: 1 }] };
    const server = { ...empty(), streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'success', updated_at: '2026-06-28T12:00:00.000Z' }] };
    vi.mocked(extractUserData).mockResolvedValue(local);
    vi.mocked(fetchUserData).mockResolvedValue(server);
    vi.mocked(mergeUserData).mockReturnValue(server);
    const result = await runBidirectionalInitialSync({ logLabel: 'test', db, serverUrl: 'https://mgmt.levier.cc', serverToken: 'tok' });
    expect(result.pullOk).toBe(true);
    expect(mergeUserData).toHaveBeenCalledWith(local, server);
    expect(hydrateDb).toHaveBeenCalled();
    expect(pushUserDataDiff).not.toHaveBeenCalled();
  });

  it('uploads local data as row patch when server is empty', async () => {
    const local = { ...empty(), appKv: [{ key: 'k', value: 'v', updated_at: 1 }] };
    vi.mocked(extractUserData).mockResolvedValue(local);
    vi.mocked(fetchUserData).mockResolvedValue(empty());
    const result = await runBidirectionalInitialSync({ logLabel: 'test', db, serverUrl: 'https://mgmt.levier.cc', serverToken: 'tok' });
    expect(result.pullOk).toBe(true);
    expect(pushUserDataDiff).toHaveBeenCalled();
    expect(vi.mocked(pushUserDataDiff).mock.calls[0]?.[2]).toEqual(empty());
    expect(vi.mocked(pushUserDataDiff).mock.calls[0]?.[3]).toEqual(local);
  });
});

describe('pullAndMergeUserData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractUserData).mockResolvedValue(empty());
    vi.mocked(fetchUserData).mockResolvedValue(empty());
    vi.mocked(hydrateDbFromServer).mockResolvedValue('hydrated');
    vi.mocked(hydrateDb).mockResolvedValue(undefined);
    vi.mocked(pushUserDataDiff).mockResolvedValue(undefined);
    vi.mocked(mergeUserData).mockReturnValue(empty());
  });

  it('returns false without creds', async () => {
    expect(await pullAndMergeUserData({ logLabel: 'test', db })).toBe(false);
  });

  it('skips hydrate when local edits landed during fetch and already match merge', async () => {
    const localBefore = {
      ...empty(),
      streakActivities: [{
        id: 'run', name: 'Run', description: null, frequency: 'daily', weekly_target: null,
        scheduled_days_json: null, can_fail: 0, necessary: 0, archived_at: null, sort_order: 0,
        linked_staple_id: null, linked_water: 0, linked_movement_burst: 0,
        extra_calories: null, extra_protein: null, extra_water_ml: null,
        updated_at: '2026-07-01T00:00:00.000Z'
      }]
    };
    const localNow = {
      ...empty(),
      streakActivities: [{
        id: 'run', name: 'Morning run', description: null, frequency: 'daily', weekly_target: null,
        scheduled_days_json: null, can_fail: 0, necessary: 0, archived_at: null, sort_order: 0,
        linked_staple_id: null, linked_water: 0, linked_movement_burst: 0,
        extra_calories: null, extra_protein: null, extra_water_ml: null,
        updated_at: '2026-07-20T12:00:00.000Z'
      }]
    };
    const server = {
      ...empty(),
      appKv: [{ key: 'prefs', value: 'x', updated_at: 1 }]
    };
    vi.mocked(extractUserData)
      .mockResolvedValueOnce(localBefore)
      .mockResolvedValueOnce(localNow)
      .mockResolvedValue(localNow);
    vi.mocked(fetchUserData).mockResolvedValue(server);
    vi.mocked(mergeUserData)
      .mockReturnValueOnce(server)
      .mockReturnValueOnce(localNow);
    const ok = await pullAndMergeUserData({ logLabel: 'test', db, serverUrl: 'https://mgmt.levier.cc', serverToken: 'tok' });
    expect(ok).toBe(true);
    expect(mergeUserData).toHaveBeenCalledTimes(2);
    expect(hydrateDb).not.toHaveBeenCalled();
    expect(pushUserDataDiff).toHaveBeenCalledWith('https://mgmt.levier.cc', 'tok', server, localNow);
  });

  it('hydrates when concurrent local edit is missing a newer server row', async () => {
    const oldA = {
      id: 'run', name: 'Run', description: null, frequency: 'daily', weekly_target: null,
      scheduled_days_json: null, can_fail: 0, necessary: 0, archived_at: null, sort_order: 0,
      linked_staple_id: null, linked_water: 0, linked_movement_burst: 0,
      extra_calories: null, extra_protein: null, extra_water_ml: null,
      updated_at: '2026-07-01T00:00:00.000Z'
    };
    const oldB = { ...oldA, id: 'water', name: 'Water', sort_order: 1 };
    const serverA = { ...oldA, name: 'Server run', updated_at: '2026-07-20T10:00:00.000Z' };
    const localB = { ...oldB, name: 'Local water', updated_at: '2026-07-20T11:00:00.000Z' };
    const mergedA = serverA;
    const mergedB = localB;
    const localBefore = { ...empty(), streakActivities: [oldA, oldB] };
    const localNow = { ...empty(), streakActivities: [oldA, localB] };
    const server = { ...empty(), streakActivities: [serverA, oldB], appKv: [{ key: 'prefs', value: 'x', updated_at: 1 }] };
    const remoteMerged = { ...empty(), streakActivities: [serverA, oldB] };
    const merged = { ...empty(), streakActivities: [mergedA, mergedB] };
    vi.mocked(extractUserData)
      .mockResolvedValueOnce(localBefore)
      .mockResolvedValueOnce(localNow)
      .mockResolvedValue(merged);
    vi.mocked(fetchUserData).mockResolvedValue(server);
    vi.mocked(mergeUserData)
      .mockReturnValueOnce(remoteMerged)
      .mockReturnValueOnce(merged);
    const ok = await pullAndMergeUserData({ logLabel: 'test', db, serverUrl: 'https://mgmt.levier.cc', serverToken: 'tok' });
    expect(ok).toBe(true);
    expect(hydrateDb).toHaveBeenCalledWith(db, merged, { alreadyLocked: true });
  });
});
