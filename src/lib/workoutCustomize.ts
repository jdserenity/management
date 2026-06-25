import type { ExerciseDefinition, ExerciseUnit } from '@/lib/workoutPlanner';

export const STRETCH_DEFAULT_SECONDS = 20;
export const STRETCH_ROLL_HOLD_SECONDS = 30;
export const STRETCH_ROLL_PICK_KEYS = new Set(['stretch-neck-roll', 'stretch-hip-roll']);

const NON_STRETCH_WORKOUT_IDS = [
  'march-spot',
  'jumping-jacks',
  'push-ups',
  'air-squats',
  'shadowboxing',
  'arm-rolls',
  'reverse-lunges',
  'reverse-crunches',
  'plank'
] as const;

const LEGACY_DEFAULT_ALLOWED = [
  ...NON_STRETCH_WORKOUT_IDS,
  'stretch-mobility'
] as const;

export const MIXED_BREAK_MAX_SECONDS = 180;
export const FILLS_ENTIRE_BREAK_CONFIRM_MESSAGE =
  'This exercise will take up the entire exercise break, is that okay?';

export interface WorkoutCustomizePrefs {
  allowedWorkoutIds: string[];
  allowedStretchPickKeys: string[];
  exerciseOverrides: Record<string, { amount: number; unit: ExerciseUnit }>;
  stretchHoldSeconds: number;
  customExercises: ExerciseDefinition[];
}

export const DEFAULT_STRETCH_PICK_KEYS = [
  'stretch-butterfly',
  'stretch-neck-roll',
  'stretch-hip-roll',
  'stretch-foot',
  'stretch-lateral-shoulder',
  'stretch-toe-both',
  'stretch-toe-one',
  'stretch-deep-squat',
  'stretch-quad-standing',
  'stretch-forward-hang'
] as const;

export const stretchHoldSecondsForPickKey = (pickKey: string, prefs: WorkoutCustomizePrefs): number => {
  if (STRETCH_ROLL_PICK_KEYS.has(pickKey)) return STRETCH_ROLL_HOLD_SECONDS;
  return prefs.stretchHoldSeconds > 0 ? prefs.stretchHoldSeconds : STRETCH_DEFAULT_SECONDS;
};

export const maxStretchHoldSeconds = (prefs: WorkoutCustomizePrefs): number =>
  Math.max(...DEFAULT_STRETCH_PICK_KEYS.map((key) => stretchHoldSecondsForPickKey(key, prefs)));

export const defaultWorkoutCustomizePrefs = (): WorkoutCustomizePrefs => ({
  allowedWorkoutIds: [...NON_STRETCH_WORKOUT_IDS],
  allowedStretchPickKeys: [...DEFAULT_STRETCH_PICK_KEYS],
  exerciseOverrides: {},
  stretchHoldSeconds: STRETCH_DEFAULT_SECONDS,
  customExercises: []
});

export const formatTimedDuration = (totalSeconds: number): string => {
  const sec = Math.max(0, Math.round(totalSeconds));
  if (sec === 0) return '0s';
  if (sec === 60) return '60s';
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  if (rem === 0) return `${mins} min`;
  return `${mins} min ${rem}s`;
};

export const exerciseDefinitionTimedSeconds = (exercise: ExerciseDefinition): number => {
  if (exercise.unit === 'seconds') return exercise.amount;
  if (exercise.unit === 'minutes') return exercise.amount * 60;
  return 0;
};

export const fillsEntireExerciseBreak = (timedSeconds: number, stretchHoldSeconds: number): boolean => {
  const stretch = Math.max(0, Math.round(stretchHoldSeconds));
  const timed = Math.max(0, Math.round(timedSeconds));
  return timed >= MIXED_BREAK_MAX_SECONDS - stretch;
};

export const timedExerciseNeedsFillBreakConfirm = (
  exercise: ExerciseDefinition,
  stretchHoldSeconds: number
): boolean => {
  if (exercise.unit === 'reps') return false;
  return fillsEntireExerciseBreak(exerciseDefinitionTimedSeconds(exercise), stretchHoldSeconds);
};

const clampAmount = (amount: number): number => Math.max(0, Math.round(amount));

export const applyExerciseOverride = (
  exercise: ExerciseDefinition,
  overrides: Record<string, { amount: number; unit: ExerciseUnit }>
): ExerciseDefinition => {
  const o = overrides[exercise.id];
  if (!o) return { ...exercise };
  return { ...exercise, amount: clampAmount(o.amount), unit: o.unit };
};

export const mergeExerciseOverride = (
  overrides: Record<string, { amount: number; unit: ExerciseUnit }>,
  exerciseId: string,
  amount: number,
  unit: ExerciseUnit
): Record<string, { amount: number; unit: ExerciseUnit }> => ({
  ...overrides,
  [exerciseId]: { amount: clampAmount(amount), unit }
});

export const resolveAllowedWorkoutIdsFromPrefs = (prefs: WorkoutCustomizePrefs): string[] => {
  const valid = new Set(NON_STRETCH_WORKOUT_IDS);
  const filtered = prefs.allowedWorkoutIds.filter((id) => valid.has(id as (typeof NON_STRETCH_WORKOUT_IDS)[number]));
  const hasStretches = resolveAllowedStretchPickKeys(prefs).length > 0;
  const hasCustom = prefs.customExercises.length > 0;
  if (filtered.length > 0 || hasStretches || hasCustom) return filtered.length > 0 ? filtered : [];
  return [...NON_STRETCH_WORKOUT_IDS];
};

export const resolveAllowedStretchPickKeys = (prefs: WorkoutCustomizePrefs): string[] => {
  const valid = new Set(DEFAULT_STRETCH_PICK_KEYS);
  const filtered = prefs.allowedStretchPickKeys.filter((k) => valid.has(k as (typeof DEFAULT_STRETCH_PICK_KEYS)[number]));
  return filtered.length > 0 ? filtered : [...DEFAULT_STRETCH_PICK_KEYS];
};

export const normalizeWorkoutCustomizePrefs = (
  raw: Partial<WorkoutCustomizePrefs> | null | undefined,
  legacyAllowedWorkoutIds?: string[] | null
): WorkoutCustomizePrefs => {
  const base = defaultWorkoutCustomizePrefs();
  if (!raw && !legacyAllowedWorkoutIds) return base;
  const legacy = legacyAllowedWorkoutIds ?? (raw?.allowedWorkoutIds !== undefined ? raw.allowedWorkoutIds : base.allowedWorkoutIds);
  const legacyHadStretch = legacy.includes('stretch-mobility');
  const validWorkout = new Set(NON_STRETCH_WORKOUT_IDS);
  const allowedWorkoutIds =
    raw?.allowedWorkoutIds !== undefined
      ? raw.allowedWorkoutIds.filter((id) => validWorkout.has(id as (typeof NON_STRETCH_WORKOUT_IDS)[number]))
      : legacy.filter((id) => id !== 'stretch-mobility' && validWorkout.has(id as (typeof NON_STRETCH_WORKOUT_IDS)[number]));
  const validStretch = new Set(DEFAULT_STRETCH_PICK_KEYS);
  const allowedStretchPickKeys =
    raw?.allowedStretchPickKeys !== undefined
      ? raw.allowedStretchPickKeys.filter((k) => validStretch.has(k as (typeof DEFAULT_STRETCH_PICK_KEYS)[number]))
      : legacyHadStretch
        ? [...DEFAULT_STRETCH_PICK_KEYS]
        : base.allowedStretchPickKeys;
  const stretchHoldSeconds =
    typeof raw?.stretchHoldSeconds === 'number' && raw.stretchHoldSeconds > 0
      ? clampAmount(raw.stretchHoldSeconds)
      : base.stretchHoldSeconds;
  const exerciseOverrides = raw?.exerciseOverrides && typeof raw.exerciseOverrides === 'object' ? raw.exerciseOverrides : {};
  const customExercises = Array.isArray(raw?.customExercises)
    ? raw.customExercises.filter((e): e is ExerciseDefinition => Boolean(e?.id && e?.name && e?.unit))
    : [];
  const merged: WorkoutCustomizePrefs = {
    allowedWorkoutIds:
      raw?.allowedWorkoutIds !== undefined ? allowedWorkoutIds : allowedWorkoutIds.length > 0 ? allowedWorkoutIds : base.allowedWorkoutIds,
    allowedStretchPickKeys:
      raw?.allowedStretchPickKeys !== undefined ? allowedStretchPickKeys : allowedStretchPickKeys.length > 0 ? allowedStretchPickKeys : base.allowedStretchPickKeys,
    exerciseOverrides,
    stretchHoldSeconds,
    customExercises
  };
  const hasMoves =
    merged.allowedWorkoutIds.length > 0 ||
    resolveAllowedStretchPickKeys(merged).length > 0 ||
    merged.customExercises.length > 0;
  if (!hasMoves) return base;
  return merged;
};

export const prefsHasAtLeastOneMove = (prefs: WorkoutCustomizePrefs): boolean =>
  resolveAllowedWorkoutIdsFromPrefs(prefs).length > 0 ||
  resolveAllowedStretchPickKeys(prefs).length > 0 ||
  prefs.customExercises.length > 0;

/** Legacy KV allowed_workout_ids (includes stretch-mobility). */
export const allowedWorkoutIdsForLegacyKv = (prefs: WorkoutCustomizePrefs): string[] => {
  const ids = resolveAllowedWorkoutIdsFromPrefs(prefs);
  const stretches = resolveAllowedStretchPickKeys(prefs);
  const out = [...ids];
  if (stretches.length > 0 && !out.includes('stretch-mobility')) out.push('stretch-mobility');
  return out.length > 0 ? out : [...LEGACY_DEFAULT_ALLOWED];
};
