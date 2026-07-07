import { getStatsDayWindow } from '@/lib/dayBoundary';
import { getDb } from '@/lib/db';

export const KV_POMODORO_BREAK_CHAIN = 'pomodoro_break_chain_v1';

type AppKvRow = { value: string };

export type PomodoroBreakChainRecord = {
  completedPomodoros: number;
  statsDayStartTs: number;
};

const getKv = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const rows = await db.select<AppKvRow[]>('SELECT value FROM app_kv WHERE key = $1 LIMIT 1', [key]);
  return rows[0]?.value ?? null;
};

const setKv = async (key: string, value: string): Promise<void> => {
  const db = await getDb();
  await db.execute(
    'INSERT INTO app_kv (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, value, Date.now()]
  );
};

export const parsePomodoroBreakChainRecord = (raw: string | null): PomodoroBreakChainRecord | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PomodoroBreakChainRecord;
    if (typeof parsed.completedPomodoros !== 'number' || typeof parsed.statsDayStartTs !== 'number') return null;
    return {
      completedPomodoros: Math.max(0, Math.floor(parsed.completedPomodoros)),
      statsDayStartTs: parsed.statsDayStartTs
    };
  } catch {
    return null;
  }
};

export const pomodoroBreakChainForDay = (
  record: PomodoroBreakChainRecord | null,
  dayRolloverHour: number,
  nowMs: number = Date.now()
): number => {
  const { startTs } = getStatsDayWindow(nowMs, dayRolloverHour);
  if (!record || record.statsDayStartTs !== startTs) return 0;
  return record.completedPomodoros;
};

export const loadPomodoroBreakChain = async (
  dayRolloverHour: number,
  nowMs: number = Date.now()
): Promise<number> => {
  const record = parsePomodoroBreakChainRecord(await getKv(KV_POMODORO_BREAK_CHAIN));
  return pomodoroBreakChainForDay(record, dayRolloverHour, nowMs);
};

export const savePomodoroBreakChain = async (
  completedPomodoros: number,
  dayRolloverHour: number,
  nowMs: number = Date.now()
): Promise<void> => {
  const { startTs } = getStatsDayWindow(nowMs, dayRolloverHour);
  const payload: PomodoroBreakChainRecord = {
    completedPomodoros: Math.max(0, Math.floor(completedPomodoros)),
    statsDayStartTs: startTs
  };
  await setKv(KV_POMODORO_BREAK_CHAIN, JSON.stringify(payload));
};
