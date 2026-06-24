import { isTimestampInStatsDay } from '@/lib/dayBoundary';
import { scaleExercisesByRatio } from '@/lib/sessionProgress';
import {
  applyExerciseOverride,
  resolveAllowedStretchPickKeys,
  resolveAllowedWorkoutIdsFromPrefs,
  stretchHoldSecondsForPickKey,
  type WorkoutCustomizePrefs
} from '@/lib/workoutCustomize';
import {
  PREDEFINED_WORKOUTS,
  STRETCH_PICK_CATALOG,
  stretchPickToExercises,
  sumExerciseVolume,
  type ExerciseDefinition,
  type WorkoutLogEntry
} from '@/lib/workoutPlanner';
import {
  DEFAULT_MORNING_STRETCH_HIDE_AFTER_HOUR,
  type MorningStretchPrefs
} from '@/lib/morningStretch/morningStretchPref';

export const MORNING_STRETCH_WORKOUT_ID = 'morning-stretch';
export const MORNING_STRETCH_WORKOUT_NAME = '🌅 Morning stretch';

export type MorningStretchRefKind = 'predefined' | 'stretchPick' | 'custom';

export type MorningStretchRef = {
  kind: MorningStretchRefKind;
  id: string;
};

export type MorningStretchRoutine = {
  exerciseRefs: MorningStretchRef[];
};

export type MorningStretchCatalogEntry = {
  ref: MorningStretchRef;
  label: string;
  group: 'moves' | 'stretches' | 'custom';
};

const refKey = (ref: MorningStretchRef): string => `${ref.kind}:${ref.id}`;

export const defaultMorningStretchRoutine = (): MorningStretchRoutine => ({ exerciseRefs: [] });

export const listMorningStretchCatalog = (prefs: WorkoutCustomizePrefs): MorningStretchCatalogEntry[] => {
  const out: MorningStretchCatalogEntry[] = [];
  const allowedWorkoutIds = new Set(resolveAllowedWorkoutIdsFromPrefs(prefs));
  PREDEFINED_WORKOUTS.filter((w) => w.id !== 'stretch-mobility' && allowedWorkoutIds.has(w.id)).forEach((w) => {
    out.push({ ref: { kind: 'predefined', id: w.id }, label: w.name, group: 'moves' });
  });
  const allowedStretchKeys = new Set(resolveAllowedStretchPickKeys(prefs));
  STRETCH_PICK_CATALOG.filter((row) => allowedStretchKeys.has(row.key)).forEach((row) => {
    out.push({ ref: { kind: 'stretchPick', id: row.key }, label: row.label, group: 'stretches' });
  });
  prefs.customExercises.forEach((ex) => {
    out.push({ ref: { kind: 'custom', id: ex.id }, label: ex.name, group: 'custom' });
  });
  return out;
};

const catalogRefSet = (prefs: WorkoutCustomizePrefs): Set<string> =>
  new Set(listMorningStretchCatalog(prefs).map((row) => refKey(row.ref)));

export const isMorningStretchRefAvailable = (ref: MorningStretchRef, prefs: WorkoutCustomizePrefs): boolean =>
  catalogRefSet(prefs).has(refKey(ref));

export const normalizeMorningStretchRoutine = (
  raw: Partial<MorningStretchRoutine> | null | undefined,
  prefs: WorkoutCustomizePrefs
): MorningStretchRoutine => {
  const valid = catalogRefSet(prefs);
  const refs = Array.isArray(raw?.exerciseRefs)
    ? raw!.exerciseRefs.filter(
        (ref): ref is MorningStretchRef =>
          Boolean(ref?.id && ref?.kind && valid.has(refKey({ kind: ref.kind, id: ref.id })))
      )
    : [];
  return { exerciseRefs: refs };
};

const resolveRefExercises = (ref: MorningStretchRef, prefs: WorkoutCustomizePrefs): ExerciseDefinition[] => {
  if (ref.kind === 'predefined') {
    const workout = PREDEFINED_WORKOUTS.find((w) => w.id === ref.id);
    if (!workout) return [];
    return workout.exercises.map((ex) => applyExerciseOverride(ex, prefs.exerciseOverrides));
  }
  if (ref.kind === 'stretchPick') {
    const row = STRETCH_PICK_CATALOG.find((r) => r.key === ref.id);
    if (!row) return [];
    const hold = stretchHoldSecondsForPickKey(row.key, prefs);
    return stretchPickToExercises(row.pick, hold).map((ex) => applyExerciseOverride(ex, prefs.exerciseOverrides));
  }
  const custom = prefs.customExercises.find((ex) => ex.id === ref.id);
  if (!custom) return [];
  return [applyExerciseOverride(custom, prefs.exerciseOverrides)];
};

export const resolveMorningStretchExercises = (
  routine: MorningStretchRoutine,
  prefs: WorkoutCustomizePrefs
): ExerciseDefinition[] =>
  routine.exerciseRefs.flatMap((ref) => resolveRefExercises(ref, prefs));

export const isMorningStretchCompletedToday = (
  logs: WorkoutLogEntry[],
  nowTimestamp: number = Date.now(),
  rolloverHour: number
): boolean =>
  logs.some(
    (log) =>
      log.workoutId === MORNING_STRETCH_WORKOUT_ID &&
      isTimestampInStatsDay(log.completedAt, nowTimestamp, rolloverHour)
  );

export const morningStretchHideCutoffMs = (nowTimestamp: number, hideAfterHour: number): number => {
  const d = new Date(nowTimestamp);
  d.setHours(hideAfterHour, 0, 0, 0);
  return d.getTime();
};

export const isBeforeMorningStretchHideCutoff = (
  nowTimestamp: number = Date.now(),
  hideAfterHour: number = DEFAULT_MORNING_STRETCH_HIDE_AFTER_HOUR
): boolean => nowTimestamp < morningStretchHideCutoffMs(nowTimestamp, hideAfterHour);

export type MorningStretchVisibilityInput = {
  prefs: Pick<MorningStretchPrefs, 'enabled' | 'hideAfterHour'>;
  completedToday: boolean;
  nowTimestamp?: number;
  /** Keep visible while a timed block is running. */
  activeRun?: boolean;
};

export const shouldShowMorningStretchSection = ({
  prefs,
  completedToday,
  nowTimestamp = Date.now(),
  activeRun = false
}: MorningStretchVisibilityInput): boolean => {
  if (activeRun) return true;
  if (!prefs.enabled) return false;
  if (completedToday) return false;
  return isBeforeMorningStretchHideCutoff(nowTimestamp, prefs.hideAfterHour);
};

export const morningStretchCompletionRatio = (
  elapsedSeconds: number,
  durationMinutes: number
): number => {
  const total = Math.max(1, durationMinutes * 60);
  return Math.min(1, Math.max(0, elapsedSeconds / total));
};

export const buildMorningStretchLogEntry = (
  exercises: ExerciseDefinition[],
  id: string,
  completedAt: number = Date.now(),
  completionRatio: number = 1
): WorkoutLogEntry => {
  const ratio = Math.min(1, Math.max(0, completionRatio));
  const scaled = scaleExercisesByRatio(exercises, ratio);
  const vol = sumExerciseVolume(scaled);
  return {
    id,
    workoutId: MORNING_STRETCH_WORKOUT_ID,
    workoutName: MORNING_STRETCH_WORKOUT_NAME,
    completedAt,
    exercises: scaled,
    totalReps: vol.reps,
    totalTimedSeconds: vol.timedSeconds,
    completionRatio: ratio
  };
};
