import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  KV_STREAK_HEATMAP_COLOR,
  loadStreakHeatmapColorPref,
  normalizeHeatmapColor,
  saveStreakHeatmapColorPref
} from '@/lib/streakHeatmapPref';

const { kvStore } = vi.hoisted(() => ({ kvStore: new Map<string, string>() }));

vi.mock('@/lib/db', () => ({
  getDb: async () => ({
    select: async (_sql: string, params: [string]) => {
      const v = kvStore.get(params[0]);
      return v !== undefined ? [{ value: v }] : [];
    },
    execute: async (sql: string, params: unknown[]) => {
      if (sql.includes('DELETE')) kvStore.delete(params[0] as string);
      else kvStore.set(params[0] as string, params[1] as string);
    }
  })
}));

describe('streakHeatmapPref', () => {
  beforeEach(() => kvStore.clear());

  it('normalizeHeatmapColor accepts 6-digit hex', () => {
    expect(normalizeHeatmapColor('#22C55E')).toBe('#22c55e');
    expect(normalizeHeatmapColor('')).toBeNull();
    expect(normalizeHeatmapColor('#abc')).toBeNull();
  });

  it('defaults to null when unset', async () => {
    expect(await loadStreakHeatmapColorPref()).toBeNull();
  });

  it('persists color in app_kv', async () => {
    expect(await saveStreakHeatmapColorPref('#ff00aa')).toBe('#ff00aa');
    expect(kvStore.get(KV_STREAK_HEATMAP_COLOR)).toBe('#ff00aa');
    expect(await loadStreakHeatmapColorPref()).toBe('#ff00aa');
  });

  it('clears kv when color is cleared', async () => {
    await saveStreakHeatmapColorPref('#112233');
    expect(await saveStreakHeatmapColorPref(null)).toBeNull();
    expect(kvStore.has(KV_STREAK_HEATMAP_COLOR)).toBe(false);
  });
});
