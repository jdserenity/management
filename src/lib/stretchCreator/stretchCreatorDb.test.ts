import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultWorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import {
  KV_MORNING_STRETCH_ROUTINE
} from '@/lib/morningStretch/morningStretchDb';
import {
  KV_MORNING_STRETCH_DURATION_MINUTES,
  KV_MORNING_STRETCH_ENABLED,
  KV_MORNING_STRETCH_HIDE_AFTER_HOUR
} from '@/lib/morningStretch/morningStretchPref';
import { BUILTIN_MORNING_STRETCH_ID, defaultBuiltinMorningStretch } from '@/lib/stretchCreator/stretchCreator';
import type { StretchDefinition } from '@/lib/stretchCreator/stretchCreator';
import {
  KV_STRETCH_DEFINITIONS,
  loadStretchDefinitions,
  saveStretchDefinitions,
  upsertStretchDefinition
} from '@/lib/stretchCreator/stretchCreatorDb';

const { kvStore } = vi.hoisted(() => ({ kvStore: new Map<string, string>() }));

vi.mock('@/lib/db', () => ({
  getDb: async () => ({
    select: async (_sql: string, params: [string]) => {
      const v = kvStore.get(params[0]);
      return v !== undefined ? [{ value: v }] : [];
    },
    execute: async (_sql: string, params: unknown[]) => {
      kvStore.set(params[0] as string, params[1] as string);
    }
  })
}));

describe('stretchCreatorDb', () => {
  beforeEach(() => kvStore.clear());

  it('returns built-in morning stretch when unset', async () => {
    const stretches = await loadStretchDefinitions();
    expect(stretches).toHaveLength(1);
    expect(stretches[0].id).toBe(BUILTIN_MORNING_STRETCH_ID);
    expect(stretches[0].builtIn).toBe(true);
  });

  it('migrates legacy morning stretch keys on first load', async () => {
    kvStore.set(KV_MORNING_STRETCH_ENABLED, 'false');
    kvStore.set(KV_MORNING_STRETCH_DURATION_MINUTES, '10');
    kvStore.set(KV_MORNING_STRETCH_HIDE_AFTER_HOUR, '9');
    kvStore.set(
      KV_MORNING_STRETCH_ROUTINE,
      JSON.stringify({ exerciseRefs: [{ kind: 'stretchPick', id: 'stretch-neck-roll' }] })
    );
    const stretches = await loadStretchDefinitions(defaultWorkoutCustomizePrefs());
    const morning = stretches.find((s) => s.id === BUILTIN_MORNING_STRETCH_ID);
    expect(morning?.enabled).toBe(false);
    expect(morning?.durationMinutes).toBe(10);
    expect(morning?.trigger).toEqual({ mode: 'scheduled', hideAfterHour: 9 });
    expect(morning?.exerciseRefs).toEqual([{ kind: 'stretchPick', id: 'stretch-neck-roll' }]);
    expect(kvStore.has(KV_STRETCH_DEFINITIONS)).toBe(true);
  });

  it('persists custom stretches alongside built-in', async () => {
    const custom = defaultBuiltinMorningStretch();
    custom.id = 'stretch-custom';
    custom.builtIn = false;
    custom.name = 'After run';
    custom.workoutId = 'stretch-custom';
    custom.trigger = { mode: 'manual' };
    await saveStretchDefinitions([defaultBuiltinMorningStretch(), custom]);
    const loaded = await loadStretchDefinitions();
    expect(loaded).toHaveLength(2);
    expect(loaded.some((s) => s.id === 'stretch-custom')).toBe(true);
  });

  it('repairs and persists built-in morning stretch when pool stripping left a subset', async () => {
    const subset = defaultBuiltinMorningStretch().exerciseRefs.slice(0, 4);
    kvStore.set(KV_STRETCH_DEFINITIONS, JSON.stringify([{ ...defaultBuiltinMorningStretch(), exerciseRefs: subset }]));
    const loaded = await loadStretchDefinitions(defaultWorkoutCustomizePrefs());
    const morning = loaded.find((s) => s.id === BUILTIN_MORNING_STRETCH_ID);
    expect(morning?.exerciseRefs).toHaveLength(6);
    const persisted = JSON.parse(kvStore.get(KV_STRETCH_DEFINITIONS)!) as StretchDefinition[];
    expect(persisted.find((s) => s.id === BUILTIN_MORNING_STRETCH_ID)?.exerciseRefs).toHaveLength(6);
  });

  it('upsertStretchDefinition keeps legacy morning_stretch keys in sync for companion sync', async () => {
    await loadStretchDefinitions(defaultWorkoutCustomizePrefs());
    const patched = {
      ...defaultBuiltinMorningStretch(),
      enabled: false,
      durationMinutes: 7,
      trigger: { mode: 'scheduled' as const, hideAfterHour: 9 },
      exerciseRefs: [{ kind: 'stretchPick' as const, id: 'stretch-neck-roll' }]
    };
    await upsertStretchDefinition(patched, defaultWorkoutCustomizePrefs());
    expect(kvStore.get(KV_MORNING_STRETCH_ENABLED)).toBe('false');
    expect(kvStore.get(KV_MORNING_STRETCH_DURATION_MINUTES)).toBe('7');
    expect(kvStore.get(KV_MORNING_STRETCH_HIDE_AFTER_HOUR)).toBe('9');
    expect(JSON.parse(kvStore.get(KV_MORNING_STRETCH_ROUTINE)!)).toEqual({
      exerciseRefs: [{ kind: 'stretchPick', id: 'stretch-neck-roll' }]
    });
    const loaded = JSON.parse(kvStore.get(KV_STRETCH_DEFINITIONS)!) as StretchDefinition[];
    expect(loaded.find((s) => s.id === BUILTIN_MORNING_STRETCH_ID)?.durationMinutes).toBe(7);
  });
});
