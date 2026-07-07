import type { StreakLogCell, StreakLogState } from '@/lib/streak/types';

export const LEGACY_EPOCH = '1970-01-01T00:00:00.000Z';

export const getLogState = (cell: StreakLogCell | string | null | undefined): StreakLogState | null => {
  if (cell == null) return null;
  if (typeof cell === 'string') return cell as StreakLogState;
  if (typeof cell === 'object' && cell.state != null) return cell.state === 'none' ? null : cell.state;
  return null;
};

export const cellUpdatedAt = (cell: StreakLogCell | string | null | undefined, fallback = LEGACY_EPOCH): string => {
  if (cell == null) return fallback;
  if (typeof cell === 'string') return LEGACY_EPOCH;
  return cell.updatedAt || LEGACY_EPOCH;
};

export const makeLogCell = (state: StreakLogState | null, updatedAt?: string): StreakLogCell | null => {
  if (state == null || state === 'none') return null;
  return { state, updatedAt: updatedAt || new Date().toISOString() };
};

export const makeDeletionCell = (updatedAt?: string): StreakLogCell => ({
  state: 'none',
  updatedAt: updatedAt || new Date().toISOString()
});

export const normalizeLogCell = (
  cell: StreakLogCell | string | null | undefined,
  defaultUpdatedAt = LEGACY_EPOCH
): StreakLogCell | null => {
  if (cell == null) return null;
  if (typeof cell === 'string') return makeLogCell(cell as StreakLogState, defaultUpdatedAt);
  const state = cell.state;
  if (state == null) return null;
  if (state === 'none') return { state: 'none', updatedAt: cell.updatedAt || defaultUpdatedAt };
  return { state, updatedAt: cell.updatedAt || defaultUpdatedAt };
};

export const normalizeLogs = (
  logs: Record<string, Record<string, StreakLogCell | string | null>> | undefined,
  defaultUpdatedAt = LEGACY_EPOCH
): Record<string, Record<string, StreakLogCell>> => {
  const out: Record<string, Record<string, StreakLogCell>> = {};
  for (const date of Object.keys(logs || {})) {
    const day = logs![date];
    if (!day || typeof day !== 'object') continue;
    const nextDay: Record<string, StreakLogCell> = {};
    for (const [act, cell] of Object.entries(day)) {
      const norm = normalizeLogCell(cell, defaultUpdatedAt);
      if (norm) nextDay[act] = norm;
    }
    if (Object.keys(nextDay).length) out[date] = nextDay;
  }
  return out;
};

export const logsEqualState = (
  a: Record<string, Record<string, StreakLogCell | null>> | undefined,
  b: Record<string, Record<string, StreakLogCell | null>> | undefined,
  activityId: string,
  date: string
): boolean => getLogState(a?.[date]?.[activityId]) === getLogState(b?.[date]?.[activityId]);
