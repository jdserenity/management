import { describe, expect, it } from 'vitest';
import { mergeUserData } from './mergeUserData';
import type { UserData } from './userData';

const empty = (): UserData => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: []
});

describe('mergeUserData', () => {
  it('returns empty when both sides empty', () => {
    expect(mergeUserData(empty(), empty())).toEqual(empty());
  });

  it('returns server copy when local empty', () => {
    const server = {
      ...empty(),
      streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'success', updated_at: '2026-06-28T12:00:00.000Z' }]
    };
    const merged = mergeUserData(empty(), server);
    expect(merged.streakLogCells).toHaveLength(1);
    expect(merged.streakLogCells[0].state).toBe('success');
  });

  it('returns local copy when server empty', () => {
    const local = {
      ...empty(),
      appKv: [{ key: 'k', value: 'local', updated_at: 100 }]
    };
    const merged = mergeUserData(local, empty());
    expect(merged.appKv[0].value).toBe('local');
  });

  it('picks newer streak log cell per day+activity', () => {
    const local = {
      ...empty(),
      streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'fail', updated_at: '2026-06-28T08:00:00.000Z' }]
    };
    const server = {
      ...empty(),
      streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'success', updated_at: '2026-06-28T12:00:00.000Z' }]
    };
    const merged = mergeUserData(local, server);
    expect(merged.streakLogCells).toHaveLength(1);
    expect(merged.streakLogCells[0].state).toBe('success');
  });

  it('keeps distinct streak log cells from both devices', () => {
    const local = {
      ...empty(),
      streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'success', updated_at: '2026-06-28T08:00:00.000Z' }]
    };
    const server = {
      ...empty(),
      streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a2', state: 'success', updated_at: '2026-06-28T09:00:00.000Z' }]
    };
    const merged = mergeUserData(local, server);
    expect(merged.streakLogCells).toHaveLength(2);
  });

  it('merges app_kv by key with newer updated_at winning', () => {
    const local = { ...empty(), appKv: [{ key: 'prefs', value: 'old', updated_at: 1 }] };
    const server = { ...empty(), appKv: [{ key: 'prefs', value: 'new', updated_at: 99 }] };
    const merged = mergeUserData(local, server);
    expect(merged.appKv).toHaveLength(1);
    expect(merged.appKv[0].value).toBe('new');
  });

  it('unions focus_log by id preferring newer completed_at', () => {
    const row = { id: 'f1', session_type: 'pomodoro', completed_at: 200, duration_minutes: 25, planned_duration_minutes: 25, completion_ratio: 1 };
    const local = { ...empty(), focusLog: [{ ...row, completed_at: 100 }] };
    const server = { ...empty(), focusLog: [row] };
    const merged = mergeUserData(local, server);
    expect(merged.focusLog[0].completed_at).toBe(200);
  });
});
