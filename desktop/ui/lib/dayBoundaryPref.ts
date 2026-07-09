import { intPref } from '@/lib/appKv';
import { clampDayRolloverHour, DEFAULT_DAY_ROLLOVER_HOUR } from '@/lib/dayBoundary';

export const KV_DAY_ROLLOVER_HOUR = 'stats_day_rollover_hour_v1';

const pref = intPref(KV_DAY_ROLLOVER_HOUR, clampDayRolloverHour, DEFAULT_DAY_ROLLOVER_HOUR);

export const loadDayRolloverHourPref = (): Promise<number> => pref.load();
export const saveDayRolloverHourPref = (hour: number): Promise<number> => pref.save(hour);
