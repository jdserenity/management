import { getDb } from '@/lib/db';

export const KV_CANT_EXERCISE_MODE = 'cant_exercise_mode_v1';

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

const parseEnabled = (raw: string | null): boolean => raw === 'true';

/** Off by default — full exercise pool on scheduled breaks. */
export async function isCantExerciseModeEnabled(): Promise<boolean> {
  return parseEnabled(await getKv(KV_CANT_EXERCISE_MODE));
}

export async function setCantExerciseModeEnabled(enabled: boolean): Promise<void> {
  await setKv(KV_CANT_EXERCISE_MODE, enabled ? 'true' : 'false');
}
