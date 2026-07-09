import { describe, expect, it } from 'vitest';
import { mergeUserData } from './mergeUserData';
import type { UserData } from './userData';

const empty = (): UserData => ({
  focusLog: [], workoutLog: [], appKv: [], nutritionConfig: null,
  nutritionStaples: [], nutritionRegulars: [], nutritionEntries: [],
  streakActivities: [], streakLogCells: [], streakActivityMeta: [],
  waterConfig: null, waterEntries: []
});

const streakActivity = (overrides: Partial<UserData['streakActivities'][0]> = {}) => ({
  id: 'a1', name: 'Run', description: null, frequency: 'daily', weekly_target: null,
  scheduled_days_json: null, can_fail: 0, necessary: 0, archived_at: null, sort_order: 0,
  linked_staple_id: null, linked_water: 0,
  extra_calories: null, extra_protein: null, extra_water_ml: null,
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides
});

const staple = (overrides: Partial<UserData['nutritionStaples'][0]> = {}) => ({
  id: 's1', name: 'Eggs', calories: 140, protein: 12, ingredients_json: null, sort_order: 0,
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides
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
      streakLogCells: [{ log_date: '2026-06-28', activity_id: 'a1', state: 'failed', updated_at: '2026-06-28T08:00:00.000Z' }]
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

  it('uses habit row updated_at for archive, not check-off timestamps', () => {
    const local = {
      ...empty(),
      streakActivities: [streakActivity({ archived_at: null, updated_at: '2026-06-01T00:00:00.000Z' })],
      streakLogCells: [{ log_date: '2026-07-07', activity_id: 'a1', state: 'success', updated_at: '2026-07-07T20:00:00.000Z' }]
    };
    const server = {
      ...empty(),
      streakActivities: [streakActivity({ archived_at: '2026-07-07', updated_at: '2026-07-07T12:00:00.000Z' })],
      streakLogCells: []
    };
    const merged = mergeUserData(local, server);
    expect(merged.streakActivities[0].archived_at).toBe('2026-07-07');
  });

  it('keeps local archive when habit row is newer than server stale copy', () => {
    const local = {
      ...empty(),
      streakActivities: [streakActivity({ archived_at: '2026-07-07', updated_at: '2026-07-07T18:00:00.000Z' })],
      streakLogCells: []
    };
    const server = {
      ...empty(),
      streakActivities: [streakActivity({ archived_at: null, updated_at: '2026-06-01T00:00:00.000Z' })],
      streakLogCells: [{ log_date: '2026-07-07', activity_id: 'a1', state: 'success', updated_at: '2026-07-07T20:00:00.000Z' }]
    };
    const merged = mergeUserData(local, server);
    expect(merged.streakActivities[0].archived_at).toBe('2026-07-07');
  });

  it('merges nutrition staples per row by updated_at', () => {
    const local = { ...empty(), nutritionStaples: [staple({ name: 'Old eggs', updated_at: '2026-06-01T00:00:00.000Z' })] };
    const server = { ...empty(), nutritionStaples: [staple({ name: 'Fresh eggs', updated_at: '2026-07-01T00:00:00.000Z' })] };
    const merged = mergeUserData(local, server);
    expect(merged.nutritionStaples[0].name).toBe('Fresh eggs');
  });

  it('keeps staples edited on different devices when ids differ', () => {
    const local = { ...empty(), nutritionStaples: [staple({ id: 's1', name: 'Eggs' })] };
    const server = { ...empty(), nutritionStaples: [staple({ id: 's2', name: 'Rice' })] };
    const merged = mergeUserData(local, server);
    expect(merged.nutritionStaples).toHaveLength(2);
  });

  it('merges nutrition_config by its own updated_at', () => {
    const local = {
      ...empty(),
      nutritionConfig: { tdee: 2000, protein: 150, log_day: '2026-06-28', updated_at: '2026-06-28T08:00:00.000Z' },
      nutritionEntries: []
    };
    const server = {
      ...empty(),
      nutritionConfig: { tdee: 2200, protein: 160, log_day: '2026-06-28', updated_at: '2026-06-28T12:00:00.000Z' },
      nutritionEntries: [{ id: 'e1', log_day: '2026-06-28', kind: 'staple', ref_id: 's1', label: 'Eggs', calories: 140, protein: 12, count: 1, updated_at: '2026-01-01T00:00:00.000Z', deleted: 0 }]
    };
    const merged = mergeUserData(local, server);
    expect(merged.nutritionConfig?.tdee).toBe(2200);
  });
});
