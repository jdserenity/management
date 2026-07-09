import { loadDayRolloverHourPref } from '@/lib/dayBoundaryPref';
import { getCurrentLogDay } from '@/lib/tdee/dates';

/** Shared “stats day” string for TDEE / water (and similar day-scoped logs). */
export const loadCurrentFeatureDay = async (now = new Date()): Promise<{ day: string; rolloverHour: number }> => {
  const rolloverHour = await loadDayRolloverHourPref();
  return { day: getCurrentLogDay(now, rolloverHour), rolloverHour };
};
