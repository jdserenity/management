import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCustomEntry } from '@/lib/tdeeDb';
import type { TdeeFile } from '@/lib/tdee/types';

const { executeCalls, stapleRows, entryRows } = vi.hoisted(() => ({
  executeCalls: [] as string[],
  stapleRows: new Map<string, Record<string, unknown>>(),
  entryRows: new Map<string, Record<string, unknown>>()
}));

vi.mock('@/lib/dayBoundaryPref', () => ({
  loadDayRolloverHourPref: vi.fn(async () => 4)
}));

vi.mock('@/lib/db', () => ({
  getDb: async () => ({
    select: async <T>(sql: string, bind?: unknown[]): Promise<T> => {
      if (sql.includes('nutrition_config')) return [{ tdee: 2000, protein: 150, log_day: '2026-07-07', updated_at: '2026-07-01T00:00:00Z' }] as T;
      if (sql.includes('nutrition_staples')) return [...stapleRows.values()] as T;
      if (sql.includes('nutrition_regulars')) return [] as T;
      if (sql.includes('nutrition_entries')) {
        const day = String(bind?.[0] ?? '2026-07-07');
        return [...entryRows.values()].filter((r) => r.log_day === day) as T;
      }
      return [] as T;
    },
    execute: async (sql: string, params: unknown[] = []) => {
      executeCalls.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('INSERT INTO nutrition_entries')) {
        entryRows.set(`${params[1]}:${params[0]}`, {
          id: params[0],
          log_day: params[1],
          label: params[4],
          calories: params[5]
        });
      }
      if (sql.includes('INSERT INTO nutrition_staples')) {
        stapleRows.set(String(params[0]), { id: params[0], name: params[1] });
      }
    }
  })
}));

const baseFile = (): TdeeFile => ({
  tdee: 2000,
  protein: 150,
  staples: [],
  regulars: [],
  day: '2026-07-07',
  entries: []
});

describe('tdeeDb row-level saves', () => {
  beforeEach(() => {
    executeCalls.length = 0;
    stapleRows.clear();
    entryRows.clear();
  });

  it('addCustomEntry upserts one nutrition_entries row instead of wiping the table', async () => {
    await addCustomEntry(baseFile(), 'Banana', 105, 1, 1);
    expect(executeCalls.some((sql) => sql === 'DELETE FROM nutrition_entries')).toBe(false);
    expect(executeCalls.filter((sql) => sql.startsWith('INSERT INTO nutrition_entries'))).toHaveLength(1);
    expect([...entryRows.values()][0]?.label).toBe('Banana');
  });
});
