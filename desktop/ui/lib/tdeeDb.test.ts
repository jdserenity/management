import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addCustomEntry, loadRecentCalorieAverage } from '@/lib/tdeeDb';
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
      if (sql.includes('nutrition_config')) return [{ tdee: 2200, protein: 150, log_day: '2026-11-13', updated_at: '2026-11-01T00:00:00Z' }] as T;
      if (sql.includes('nutrition_staples')) return [...stapleRows.values()] as T;
      if (sql.includes('nutrition_regulars')) return [] as T;
      if (sql.includes('nutrition_entries')) {
        if (sql.includes('log_day >=')) {
          const start = String(bind?.[0] ?? '');
          const end = String(bind?.[1] ?? '');
          return [...entryRows.values()].filter((r) => String(r.log_day) >= start && String(r.log_day) <= end) as T;
        }
        const day = String(bind?.[0] ?? '2026-11-13');
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
          kind: params[2],
          ref_id: params[3],
          label: params[4],
          calories: params[5],
          protein: params[6],
          count: params[7],
          updated_at: params[8],
          deleted: 0
        });
      }
      if (sql.includes('INSERT INTO nutrition_staples')) {
        stapleRows.set(String(params[0]), { id: params[0], name: params[1] });
      }
    }
  })
}));

const baseFile = (): TdeeFile => ({
  tdee: 2200,
  protein: 150,
  staples: [],
  regulars: [],
  day: '2026-11-13',
  entries: []
});

const seedDay = (day: string, id: string, calories: number, count = 1) => {
  entryRows.set(`${day}:${id}`, {
    id,
    log_day: day,
    kind: 'custom',
    ref_id: null,
    label: id,
    calories,
    protein: 0,
    count,
    updated_at: `${day}T12:00:00.000Z`,
    deleted: 0
  });
};

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

describe('tdeeDb recent calorie average', () => {
  beforeEach(() => {
    executeCalls.length = 0;
    stapleRows.clear();
    entryRows.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 12, 0, 0)); // Nov 13 2026 after rollover
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('averages logged days in the window and reports surplus vs TDEE', async () => {
    seedDay('2026-11-12', 'a', 2000);
    seedDay('2026-11-13', 'b', 2600);
    seedDay('2026-10-01', 'old', 9000); // outside window
    const { summary } = await loadRecentCalorieAverage(14);
    expect(summary).toEqual({
      average: 2300,
      daysLogged: 2,
      windowDays: 14,
      tdee: 2200,
      vsTdee: 100
    });
  });

  it('returns null summary when no food in the window', async () => {
    const { summary } = await loadRecentCalorieAverage(14);
    expect(summary).toBeNull();
  });
});
