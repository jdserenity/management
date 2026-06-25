import { getDb } from '@/lib/db';
import { clampDayRolloverHour, formatDayRolloverHourLabel } from '@/lib/dayBoundary';

export const KV_MORNING_STRETCH_ENABLED = 'morning_stretch_enabled_v1';
export const KV_MORNING_STRETCH_DURATION_MINUTES = 'morning_stretch_duration_minutes_v1';
export const KV_MORNING_STRETCH_HIDE_AFTER_HOUR = 'morning_stretch_hide_after_hour_v1';

export const DEFAULT_MORNING_STRETCH_DURATION_MINUTES = 5;
export const DEFAULT_MORNING_STRETCH_HIDE_AFTER_HOUR = 11;

export type MorningStretchPrefs = {
  enabled: boolean;
  durationMinutes: number;
  hideAfterHour: number;
};

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

export const clampMorningStretchDurationMinutes = (minutes: number): number => {
  if (!Number.isFinite(minutes)) return DEFAULT_MORNING_STRETCH_DURATION_MINUTES;
  const m = Math.trunc(minutes);
  if (m < 1) return 1;
  if (m > 60) return 60;
  return m;
};

const parseEnabledDefaultOn = (raw: string | null): boolean => raw !== 'false';

export const defaultMorningStretchPrefs = (): MorningStretchPrefs => ({
  enabled: true,
  durationMinutes: DEFAULT_MORNING_STRETCH_DURATION_MINUTES,
  hideAfterHour: DEFAULT_MORNING_STRETCH_HIDE_AFTER_HOUR
});

export const normalizeMorningStretchPrefs = (raw: Partial<MorningStretchPrefs> | null | undefined): MorningStretchPrefs => {
  const base = defaultMorningStretchPrefs();
  if (!raw) return base;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    durationMinutes:
      typeof raw.durationMinutes === 'number' ? clampMorningStretchDurationMinutes(raw.durationMinutes) : base.durationMinutes,
    hideAfterHour:
      typeof raw.hideAfterHour === 'number' ? clampDayRolloverHour(raw.hideAfterHour) : base.hideAfterHour
  };
};

export const loadMorningStretchPrefs = async (): Promise<MorningStretchPrefs> => {
  const [enabledRaw, durationRaw, hideRaw] = await Promise.all([
    getKv(KV_MORNING_STRETCH_ENABLED),
    getKv(KV_MORNING_STRETCH_DURATION_MINUTES),
    getKv(KV_MORNING_STRETCH_HIDE_AFTER_HOUR)
  ]);
  const durationParsed = durationRaw !== null ? Number.parseInt(durationRaw, 10) : NaN;
  const hideParsed = hideRaw !== null ? Number.parseInt(hideRaw, 10) : NaN;
  return normalizeMorningStretchPrefs({
    enabled: parseEnabledDefaultOn(enabledRaw),
    durationMinutes: Number.isFinite(durationParsed) ? durationParsed : undefined,
    hideAfterHour: Number.isFinite(hideParsed) ? hideParsed : undefined
  });
};

export const saveMorningStretchEnabled = async (enabled: boolean): Promise<void> => {
  await setKv(KV_MORNING_STRETCH_ENABLED, enabled ? 'true' : 'false');
};

export const saveMorningStretchDurationMinutes = async (minutes: number): Promise<number> => {
  const safe = clampMorningStretchDurationMinutes(minutes);
  await setKv(KV_MORNING_STRETCH_DURATION_MINUTES, String(safe));
  return safe;
};

export const saveMorningStretchHideAfterHour = async (hour: number): Promise<number> => {
  const safe = clampDayRolloverHour(hour);
  await setKv(KV_MORNING_STRETCH_HIDE_AFTER_HOUR, String(safe));
  return safe;
};

export const formatMorningStretchHideAfterLabel = (hour: number): string => formatDayRolloverHourLabel(hour);
