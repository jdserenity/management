import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isCantExerciseModeEnabled, setCantExerciseModeEnabled } from './cantExerciseModePref';

const { kvStore } = vi.hoisted(() => ({ kvStore: new Map<string, string>() }));

vi.mock('@/lib/db', () => ({
  getDb: async () => ({
    select: async (_sql: string, params: [string]) => {
      const v = kvStore.get(params[0]);
      return v !== undefined ? [{ value: v }] : [];
    },
    execute: async (_sql: string, params: [string, string]) => {
      kvStore.set(params[0], params[1]);
    }
  })
}));

describe('cantExerciseModePref', () => {
  beforeEach(() => {
    kvStore.clear();
  });

  it('defaults to off when unset', async () => {
    expect(await isCantExerciseModeEnabled()).toBe(false);
  });

  it('persists enabled state', async () => {
    await setCantExerciseModeEnabled(true);
    expect(await isCantExerciseModeEnabled()).toBe(true);
    await setCantExerciseModeEnabled(false);
    expect(await isCantExerciseModeEnabled()).toBe(false);
  });
});
