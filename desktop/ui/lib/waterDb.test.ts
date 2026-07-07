import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addWaterEntry } from '@/lib/waterDb';
import type { WaterFile } from '@/lib/water/types';

const { executeCalls, entryRows } = vi.hoisted(() => ({
  executeCalls: [] as string[],
  entryRows: new Map<string, Record<string, unknown>>()
}));

vi.mock('@/lib/dayBoundaryPref', () => ({
  loadDayRolloverHourPref: vi.fn(async () => 4)
}));

vi.mock('@/lib/db', () => ({
  getDb: async () => ({
    select: async <T>(sql: string, bind?: unknown[]): Promise<T> => {
      if (sql.includes('water_config')) return [{ target_ml: 2500, log_day: '2026-07-07', updated_at: '2026-07-01T00:00:00Z' }] as T;
      if (sql.includes('water_entries')) {
        const day = String(bind?.[0] ?? '2026-07-07');
        return [...entryRows.values()].filter((r) => r.log_day === day) as T;
      }
      return [] as T;
    },
    execute: async (sql: string, params: unknown[] = []) => {
      executeCalls.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('INSERT INTO water_entries')) {
        entryRows.set(`${params[1]}:${params[0]}`, {
          id: params[0],
          log_day: params[1],
          label: params[2],
          ml: params[3]
        });
      }
    }
  })
}));

const baseFile = (): WaterFile => ({
  targetMl: 2500,
  day: '2026-07-07',
  entries: []
});

describe('waterDb row-level saves', () => {
  beforeEach(() => {
    executeCalls.length = 0;
    entryRows.clear();
  });

  it('addWaterEntry upserts one water_entries row instead of wiping the table', async () => {
    await addWaterEntry(baseFile(), 'Bottle', 500);
    expect(executeCalls.some((sql) => sql === 'DELETE FROM water_entries')).toBe(false);
    expect(executeCalls.filter((sql) => sql.startsWith('INSERT INTO water_entries'))).toHaveLength(1);
    expect([...entryRows.values()][0]?.ml).toBe(500);
  });
});
