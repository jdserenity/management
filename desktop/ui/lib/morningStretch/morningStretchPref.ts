import { getAppKvMany, intPref, parseBoolDefaultOn, setAppKv } from '@/lib/appKv';
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

export const clampMorningStretchDurationMinutes = (minutes: number): number => {
  if (!Number.isFinite(minutes)) return DEFAULT_MORNING_STRETCH_DURATION_MINUTES;
  const m = Math.trunc(minutes);
  if (m < 1) return 1;
  if (m > 60) return 60;
  return m;
};

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

const durationPref = intPref(
  KV_MORNING_STRETCH_DURATION_MINUTES,
  clampMorningStretchDurationMinutes,
  DEFAULT_MORNING_STRETCH_DURATION_MINUTES
);
const hidePref = intPref(
  KV_MORNING_STRETCH_HIDE_AFTER_HOUR,
  clampDayRolloverHour,
  DEFAULT_MORNING_STRETCH_HIDE_AFTER_HOUR
);

export const loadMorningStretchPrefs = async (): Promise<MorningStretchPrefs> => {
  const [enabledRaw, duration, hideAfterHour] = await Promise.all([
    getAppKvMany([KV_MORNING_STRETCH_ENABLED]).then((r) => r[0]),
    durationPref.load(),
    hidePref.load()
  ]);
  return normalizeMorningStretchPrefs({
    enabled: parseBoolDefaultOn(enabledRaw),
    durationMinutes: duration,
    hideAfterHour
  });
};

export const saveMorningStretchEnabled = async (enabled: boolean): Promise<void> => {
  await setAppKv(KV_MORNING_STRETCH_ENABLED, enabled ? 'true' : 'false');
};

export const saveMorningStretchDurationMinutes = (minutes: number): Promise<number> => durationPref.save(minutes);
export const saveMorningStretchHideAfterHour = (hour: number): Promise<number> => hidePref.save(hour);

export const formatMorningStretchHideAfterLabel = (hour: number): string => formatDayRolloverHourLabel(hour);
