import { getDb } from '@/lib/db';

export const KV_STREAK_HEATMAP_COLOR = 'streak_heatmap_color_v1';

type AppKvRow = { value: string };

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const normalizeHeatmapColor = (raw: string | null | undefined): string | null => {
  if (raw == null || raw === '') return null;
  const trimmed = raw.trim();
  if (!HEX_COLOR.test(trimmed)) return null;
  return trimmed.toLowerCase();
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

export const loadStreakHeatmapColorPref = async (): Promise<string | null> => {
  return normalizeHeatmapColor(await getKv(KV_STREAK_HEATMAP_COLOR));
};

export const saveStreakHeatmapColorPref = async (color: string | null): Promise<string | null> => {
  const normalized = normalizeHeatmapColor(color);
  if (normalized === null) {
    const db = await getDb();
    await db.execute('DELETE FROM app_kv WHERE key = $1', [KV_STREAK_HEATMAP_COLOR]);
    return null;
  }
  await setKv(KV_STREAK_HEATMAP_COLOR, normalized);
  return normalized;
};
