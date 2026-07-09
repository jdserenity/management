import { stringPref } from '@/lib/appKv';

export const KV_STREAK_HEATMAP_COLOR = 'streak_heatmap_color_v1';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const normalizeHeatmapColor = (raw: string | null | undefined): string | null => {
  if (raw == null || raw === '') return null;
  const trimmed = raw.trim();
  if (!HEX_COLOR.test(trimmed)) return null;
  return trimmed.toLowerCase();
};

const pref = stringPref(KV_STREAK_HEATMAP_COLOR, (r) => normalizeHeatmapColor(r));

export const loadStreakHeatmapColorPref = (): Promise<string | null> => pref.load();
export const saveStreakHeatmapColorPref = async (color: string | null): Promise<string | null> => {
  const normalized = normalizeHeatmapColor(color);
  await pref.save(normalized);
  return normalized;
};
