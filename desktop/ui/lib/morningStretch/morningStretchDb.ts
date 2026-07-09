import { getAppKv, setAppKv } from '@/lib/appKv';
import { defaultWorkoutCustomizePrefs, type WorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import {
  defaultMorningStretchRoutine,
  normalizeMorningStretchRoutine,
  type MorningStretchRoutine
} from '@/lib/morningStretch/morningStretch';

export const KV_MORNING_STRETCH_ROUTINE = 'morning_stretch_routine_v1';

export const loadMorningStretchRoutine = async (
  prefs: WorkoutCustomizePrefs = defaultWorkoutCustomizePrefs()
): Promise<MorningStretchRoutine> => {
  const raw = await getAppKv(KV_MORNING_STRETCH_ROUTINE);
  if (!raw) return defaultMorningStretchRoutine();
  try {
    const parsed = JSON.parse(raw) as Partial<MorningStretchRoutine>;
    if (!Array.isArray(parsed.exerciseRefs) || parsed.exerciseRefs.length === 0) return defaultMorningStretchRoutine();
    return normalizeMorningStretchRoutine(parsed, prefs);
  } catch (error) {
    console.error('Failed to parse morning_stretch_routine from app_kv:', error);
    return defaultMorningStretchRoutine();
  }
};

export const saveMorningStretchRoutine = async (routine: MorningStretchRoutine): Promise<void> => {
  await setAppKv(KV_MORNING_STRETCH_ROUTINE, JSON.stringify(routine));
};
