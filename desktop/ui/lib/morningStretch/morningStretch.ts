import { DEFAULT_DAY_ROLLOVER_HOUR, getStatsDayWindow, isTimestampInStatsDay } from '@/lib/dayBoundary';
import { scaleExercisesByRatio } from '@/lib/sessionProgress';
import {
  applyExerciseOverride,
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
  /** Optional amount for this routine only (hold seconds for stretch picks). Does not change the global stretch pool. */
  amount?: number;
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

export const isStretchExerciseRefValid = (ref: MorningStretchRef, prefs: WorkoutCustomizePrefs): boolean => {
  if (!ref?.id || !ref?.kind) return false;
  if (ref.kind === 'stretchPick') return STRETCH_PICK_CATALOG.some((row) => row.key === ref.id);
  if (ref.kind === 'predefined') return PREDEFINED_WORKOUTS.some((w) => w.id === ref.id && w.id !== 'stretch-mobility');
  if (ref.kind === 'custom') return prefs.customExercises.some((ex) => ex.id === ref.id);
  return false;
};

/** Restore shipped default refs when a large subset of defaults was saved after pool-filter stripping. */
export const repairBuiltinMorningStretchRefs = (refs: MorningStretchRef[]): MorningStretchRef[] => {
  const defaults = DEFAULT_MORNING_STRETCH_EXERCISE_REFS;
  const defaultKeySet = new Set(defaults.map(refKey));
  const savedAreOnlyDefaults = refs.length > 0 && refs.every((ref) => defaultKeySet.has(refKey(ref)));
  if (savedAreOnlyDefaults && refs.length >= 4 && refs.length < defaults.length) return [...defaults];
  return refs;
};

export const labelForMorningStretchRef = (ref: MorningStretchRef): string => {
  if (ref.kind === 'stretchPick') {
    const row = STRETCH_PICK_CATALOG.find((r) => r.key === ref.id);
    if (row) return row.label;
  }
  if (ref.kind === 'predefined') {
    const workout = PREDEFINED_WORKOUTS.find((w) => w.id === ref.id);
    if (workout) return workout.name;
  }
  return ref.id;
};

export const DEFAULT_MORNING_STRETCH_EXERCISE_REFS: MorningStretchRef[] = [
  { kind: 'stretchPick', id: 'stretch-neck-roll' },
  { kind: 'stretchPick', id: 'stretch-lateral-shoulder' },
  { kind: 'stretchPick', id: 'stretch-hip-roll' },
  { kind: 'predefined', id: 'arm-rolls' },
  { kind: 'stretchPick', id: 'stretch-deep-squat' },
  { kind: 'stretchPick', id: 'stretch-forward-hang' }
];

export const defaultMorningStretchRoutine = (): MorningStretchRoutine => ({
  exerciseRefs: [...DEFAULT_MORNING_STRETCH_EXERCISE_REFS]
});

export const listMorningStretchCatalog = (prefs: WorkoutCustomizePrefs): MorningStretchCatalogEntry[] => {
  const out: MorningStretchCatalogEntry[] = [];
  const allowedWorkoutIds = new Set(resolveAllowedWorkoutIdsFromPrefs(prefs));
  PREDEFINED_WORKOUTS.filter((w) => w.id !== 'stretch-mobility' && allowedWorkoutIds.has(w.id)).forEach((w) => {
    out.push({ ref: { kind: 'predefined', id: w.id }, label: w.name, group: 'moves' });
  });
  STRETCH_PICK_CATALOG.forEach((row) => {
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

const normalizeRefAmount = (raw: unknown): number | undefined => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const n = Math.round(raw);
  return n > 0 ? n : undefined;
};

export const normalizeMorningStretchRef = (
  ref: Partial<MorningStretchRef> | null | undefined,
  prefs: WorkoutCustomizePrefs
): MorningStretchRef | null => {
  if (!ref?.id || !ref?.kind) return null;
  const base: MorningStretchRef = { kind: ref.kind, id: ref.id };
  if (!isStretchExerciseRefValid(base, prefs)) return null;
  const amount = normalizeRefAmount(ref.amount);
  return amount != null ? { ...base, amount } : base;
};

export const normalizeMorningStretchRoutine = (
  raw: Partial<MorningStretchRoutine> | null | undefined,
  prefs: WorkoutCustomizePrefs
): MorningStretchRoutine => {
  const refs = Array.isArray(raw?.exerciseRefs)
    ? raw!.exerciseRefs
        .map((ref) => normalizeMorningStretchRef(ref, prefs))
        .filter((ref): ref is MorningStretchRef => ref != null)
    : [];
  return { exerciseRefs: refs };
};

/** Default hold/amount shown when a routine has no per-ref override. */
export const defaultAmountForStretchRef = (ref: MorningStretchRef, prefs: WorkoutCustomizePrefs): number | null => {
  if (ref.kind === 'stretchPick') return stretchHoldSecondsForPickKey(ref.id, prefs);
  if (ref.kind === 'custom') {
    const custom = prefs.customExercises.find((ex) => ex.id === ref.id);
    return custom ? custom.amount : null;
  }
  return null;
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
    const routineHold = normalizeRefAmount(ref.amount);
    const hold = routineHold ?? stretchHoldSecondsForPickKey(row.key, prefs);
    const exercises = stretchPickToExercises(row.pick, hold);
    // Routine-local hold replaces pool defaults; skip global exercise overrides so pool edits stay separate.
    if (routineHold != null) return exercises;
    return exercises.map((ex) => applyExerciseOverride(ex, prefs.exerciseOverrides));
  }
  const custom = prefs.customExercises.find((ex) => ex.id === ref.id);
  if (!custom) return [];
  const routineAmount = normalizeRefAmount(ref.amount);
  if (routineAmount != null) return [{ ...custom, amount: routineAmount }];
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
  rolloverHour?: number;
};

export const shouldShowMorningStretchSection = ({
  prefs,
  completedToday,
  nowTimestamp = Date.now(),
  activeRun = false,
  rolloverHour = DEFAULT_DAY_ROLLOVER_HOUR
}: MorningStretchVisibilityInput): boolean => {
  if (activeRun) return true;
  if (!prefs.enabled) return false;
  if (completedToday) return false;
  const { startTs } = getStatsDayWindow(nowTimestamp, rolloverHour);
  const hideCutoff = morningStretchHideCutoffMs(startTs, prefs.hideAfterHour);
  return nowTimestamp >= startTs && nowTimestamp < hideCutoff;
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
