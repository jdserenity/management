import { getDb } from '@/lib/db';
import { defaultWorkoutCustomizePrefs, type WorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import {
  defaultMorningStretchRoutine,
  normalizeMorningStretchRoutine,
  type MorningStretchRoutine
} from '@/lib/morningStretch/morningStretch';

export const KV_MORNING_STRETCH_ROUTINE = 'morning_stretch_routine_v1';

const getKv = async (key: string): Promise<string | null> => {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>('SELECT value FROM app_kv WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
};

const setKv = async (key: string, value: string): Promise<void> => {
  const db = await getDb();
  await db.execute('INSERT OR REPLACE INTO app_kv (key, value) VALUES ($1, $2)', [key, value]);
};

export const loadMorningStretchRoutine = async (
  prefs: WorkoutCustomizePrefs = defaultWorkoutCustomizePrefs()
): Promise<MorningStretchRoutine> => {
  const raw = await getKv(KV_MORNING_STRETCH_ROUTINE);
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
  await setKv(KV_MORNING_STRETCH_ROUTINE, JSON.stringify(routine));
};
