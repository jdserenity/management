import { getDb } from '@/lib/db';
import { normalizeMovementSnackPrefs, type MovementSnackPrefs } from './movementSnack';

export const KV_MOVEMENT_SNACK_PREFS = 'movement_snack_prefs_v1';

type AppKvRow = { value: string };

const getKv = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const rows = await db.select<AppKvRow[]>('SELECT value FROM app_kv WHERE key = $1 LIMIT 1',
    [key]
  );
  return rows[0]?.value ?? null;
};

const setKv = async (key: string, value: string): Promise<void> => {
  const db = await getDb();
  const updatedAt = Date.now();
  await db.execute(
    'INSERT INTO app_kv (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, value, updatedAt]
  );
};

export const loadMovementSnackPrefs = async (): Promise<MovementSnackPrefs> => {
  const raw = await getKv(KV_MOVEMENT_SNACK_PREFS);
  if (!raw) return normalizeMovementSnackPrefs(null);
  try {
    return normalizeMovementSnackPrefs(JSON.parse(raw));
  } catch {
    return normalizeMovementSnackPrefs(null);
  }
};

export const saveMovementSnackPrefs = async (prefs: MovementSnackPrefs): Promise<void> => {
  await setKv(KV_MOVEMENT_SNACK_PREFS, JSON.stringify(normalizeMovementSnackPrefs(prefs)));
};
