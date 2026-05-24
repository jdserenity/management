import { getDb } from '@/lib/db';
import { clampDayRolloverHour, DEFAULT_DAY_ROLLOVER_HOUR } from '@/lib/dayBoundary';

export const KV_DAY_ROLLOVER_HOUR = 'stats_day_rollover_hour_v1';

type AppKvRow = { value: string };

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

export const loadDayRolloverHourPref = async (): Promise<number> => {
  const raw = await getKv(KV_DAY_ROLLOVER_HOUR);
  if (raw === null) return DEFAULT_DAY_ROLLOVER_HOUR;
  const parsed = Number.parseInt(raw, 10);
  return clampDayRolloverHour(parsed);
};

export const saveDayRolloverHourPref = async (hour: number): Promise<number> => {
  const safe = clampDayRolloverHour(hour);
  await setKv(KV_DAY_ROLLOVER_HOUR, String(safe));
  return safe;
};
