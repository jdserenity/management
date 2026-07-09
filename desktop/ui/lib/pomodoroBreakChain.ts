import { getAppKv, setAppKv } from '@/lib/appKv';
import { getStatsDayWindow } from '@/lib/dayBoundary';

export const KV_POMODORO_BREAK_CHAIN = 'pomodoro_break_chain_v1';

export type PomodoroBreakChainRecord = {
  completedPomodoros: number;
  statsDayStartTs: number;
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
  const record = parsePomodoroBreakChainRecord(await getAppKv(KV_POMODORO_BREAK_CHAIN));
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
  await setAppKv(KV_POMODORO_BREAK_CHAIN, JSON.stringify(payload));
};
