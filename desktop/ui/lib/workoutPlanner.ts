import { DEFAULT_DAY_ROLLOVER_HOUR, getStatsDayWindow } from '@/lib/dayBoundary';
import type { ExerciseRunAgg } from '@mgmt/core';
import {
  applyExerciseOverride,
  defaultWorkoutCustomizePrefs,
  formatTimedDuration,
  normalizeWorkoutCustomizePrefs,
  stretchHoldSecondsForPickKey,
  STRETCH_DEFAULT_SECONDS,
  type WorkoutCustomizePrefs
} from '@/lib/workoutCustomize';

export type { WorkoutCustomizePrefs } from '@/lib/workoutCustomize';

export type SessionType = 'pomodoro' | 'deep';

export type ExerciseUnit = 'reps' | 'seconds' | 'minutes';

export interface ExerciseDefinition {
  id: string;
  name: string;
  amount: number;
  unit: ExerciseUnit;
}

/** Older logs used `{ reps }` only */
export type LegacyExercise = { id: string; name: string; reps: number };

export type StoredExercise = ExerciseDefinition | LegacyExercise;

export interface WorkoutDefinition {
  id: string;
  name: string;
  estimatedMinutes: number;
  exercises: ExerciseDefinition[];
}

export interface WorkoutLogEntry {
  id: string;
  workoutId: string;
  workoutName: string;
  completedAt: number;
  exercises: StoredExercise[];
  totalReps: number;
  totalTimedSeconds: number;
  completionRatio?: number;
}

export interface FocusLogEntry {
  id: string;
  type: SessionType;
  completedAt: number;
  /** Credited focus minutes (partial sessions use planned × completionRatio). */
  durationMinutes: number;
  plannedDurationMinutes: number;
  completionRatio: number;
}

/** Focus sessions count toward pomodoro/deep totals only at or above this completion ratio. */
export const SESSION_COUNT_MIN_RATIO = 0.75;

export const focusEntryCountsAsSession = (entry: FocusLogEntry): boolean =>
  (entry.completionRatio ?? 1) >= SESSION_COUNT_MIN_RATIO;

export const normalizeWorkoutLogs = (raw: WorkoutLogEntry[]): WorkoutLogEntry[] =>
  raw.map((log) => {
    const exercises = log.exercises ?? [];
    const vol = sumExerciseVolume(exercises);
    return {
      ...log,
      exercises,
      totalReps: typeof log.totalReps === 'number' ? log.totalReps : vol.reps,
      totalTimedSeconds: typeof log.totalTimedSeconds === 'number' ? log.totalTimedSeconds : vol.timedSeconds
    };
  });

export interface TimeSeriesPoint {
  bucket: string;
  reps: number;
  timedSeconds: number;
  workouts: number;
}

export interface WorkoutTotals {
  totalReps: number;
  totalTimedSeconds: number;
  totalWorkouts: number;
  weekly: TimeSeriesPoint[];
  monthly: TimeSeriesPoint[];
}

export interface FocusTimeSeriesPoint {
  bucket: string;
  pomodoros: number;
  deepWork: number;
  focusMinutes: number;
}

export interface PeriodStatsPoint {
  bucket: string;
  pomodoros: number;
  deepWork: number;
  focusMinutes: number;
  reps: number;
  timedSeconds: number;
  workouts: number;
}

export const SESSION_DURATIONS_MINUTES = {
  pomodoro: 25,
  deep: 90,
  break: 5,
  longBreak: 15
} as const;

export const PREDEFINED_WORKOUTS: WorkoutDefinition[] = [
  {
    id: 'march-spot',
    name: '🚶‍♂️ Walking / Marching on the Spot',
    estimatedMinutes: 1,
    exercises: [
      { id: 'march', name: 'Walking / marching in place', amount: 1, unit: 'minutes' }
    ]
  },
  {
    id: 'jumping-jacks',
    name: '🤸 Jumping Jacks',
    estimatedMinutes: 1,
    exercises: [
      { id: 'jacks', name: 'Jumping jacks', amount: 30, unit: 'reps' }
    ]
  },
  {
    id: 'push-ups',
    name: '💪 Push-ups',
    estimatedMinutes: 1,
    exercises: [
      { id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' }
    ]
  },
  {
    id: 'stretch-mobility',
    name: '🤸 Stretching / Mobility',
    estimatedMinutes: 1,
    exercises: []
  },
  {
    id: 'air-squats',
    name: '🦵 Air Squats',
    estimatedMinutes: 1,
    exercises: [
      { id: 'squats', name: 'Air squats', amount: 20, unit: 'reps' }
    ]
  },
  {
    id: 'shadowboxing',
    name: '🥊 Light Shadowboxing',
    estimatedMinutes: 1.5,
    exercises: [
      { id: 'shadow', name: 'Light shadowboxing', amount: 60, unit: 'seconds' }
    ]
  },
  {
    id: 'arm-rolls',
    name: '🔄 Arm Rolls',
    estimatedMinutes: 1,
    exercises: [
      { id: 'arm-rolls', name: 'Arm rolls', amount: 30, unit: 'seconds' }
    ]
  },
  {
    id: 'reverse-lunges',
    name: '🦵 Reverse Lunges',
    estimatedMinutes: 1,
    exercises: [
      { id: 'reverse-lunges', name: 'Reverse lunges', amount: 10, unit: 'reps' }
    ]
  },
  {
    id: 'reverse-crunches',
    name: '🤸 Reverse Crunches',
    estimatedMinutes: 1,
    exercises: [
      { id: 'reverse-crunches', name: 'Reverse crunches', amount: 15, unit: 'reps' }
    ]
  },
  {
    id: 'plank',
    name: '🧘 Plank',
    estimatedMinutes: 1,
    exercises: [
      { id: 'plank', name: 'Plank', amount: 30, unit: 'seconds' }
    ]
  }
];

export type StretchPick =
  | { kind: 'single'; id: string; name: string }
  | { kind: 'bilateral'; left: { id: string; name: string }; right: { id: string; name: string } };

export const STRETCH_PICK_CATALOG: readonly { key: string; label: string; pick: StretchPick }[] = [
  { key: 'stretch-butterfly', label: 'Butterfly Stretch', pick: { kind: 'single', id: 'stretch-butterfly', name: 'Butterfly Stretch' } },
  { key: 'stretch-neck-roll', label: 'Neck Roll', pick: { kind: 'single', id: 'stretch-neck-roll', name: 'Neck Roll' } },
  { key: 'stretch-hip-roll', label: 'Hip Roll', pick: { kind: 'single', id: 'stretch-hip-roll', name: 'Hip Roll' } },
  { key: 'stretch-foot', label: 'Foot Stretch', pick: { kind: 'single', id: 'stretch-foot', name: 'Foot Stretch' } },
  {
    key: 'stretch-lateral-shoulder',
    label: 'Lateral Shoulder Stretch (left and right)',
    pick: {
      kind: 'bilateral',
      left: { id: 'stretch-lateral-shoulder-L', name: 'Lateral Shoulder Stretch (L)' },
      right: { id: 'stretch-lateral-shoulder-R', name: 'Lateral Shoulder Stretch (R)' }
    }
  },
  { key: 'stretch-toe-both', label: 'Seated Toe Touch Both Legs', pick: { kind: 'single', id: 'stretch-toe-both', name: 'Seated Toe Touch Both Legs' } },
  {
    key: 'stretch-toe-one',
    label: 'Seated Toe Touch One Leg (left and right)',
    pick: {
      kind: 'bilateral',
      left: { id: 'stretch-toe-one-L', name: 'Seated Toe Touch One Leg (L)' },
      right: { id: 'stretch-toe-one-R', name: 'Seated Toe Touch One Leg (R)' }
    }
  },
  { key: 'stretch-deep-squat', label: 'Deep Squat', pick: { kind: 'single', id: 'stretch-deep-squat', name: 'Deep Squat' } },
  { key: 'stretch-forward-hang', label: 'Standing Forward Hang', pick: { kind: 'single', id: 'stretch-forward-hang', name: 'Standing Forward Hang' } },
  {
    key: 'stretch-quad-standing',
    label: 'Standing Quad Stretch (left and right)',
    pick: {
      kind: 'bilateral',
      left: { id: 'stretch-quad-standing-L', name: 'Standing Quad Stretch (L)' },
      right: { id: 'stretch-quad-standing-R', name: 'Standing Quad Stretch (R)' }
    }
  }
];

/** @deprecated use STRETCH_PICK_CATALOG labels */
export const STRETCH_MOBILITY_CATALOG_LINES: readonly string[] = STRETCH_PICK_CATALOG.map((row) => row.label);

export const DEFAULT_ALLOWED_WORKOUT_IDS = PREDEFINED_WORKOUTS.map((workout) => workout.id);

const toDateBucket = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toMonthBucket = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

const toWeekBucket = (timestamp: number): string => {
  const date = new Date(timestamp);
  const dayIndex = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayIndex); date.setHours(0, 0, 0, 0);
  return toDateBucket(date);
};

const parseBucketDate = (bucket: string): Date => {
  const [year, month, day] = bucket.split('-').map(Number);
  return new Date(year, month - 1, day || 1, 0, 0, 0, 0);
};

export const weekBucketRange = (bucket: string): { startTs: number; endTs: number } => {
  const start = parseBucketDate(bucket);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { startTs: start.getTime(), endTs: end.getTime() };
};

export const monthBucketRange = (bucket: string): { startTs: number; endTs: number } => {
  const [year, month] = bucket.split('-').map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { startTs: start.getTime(), endTs: end.getTime() };
};

export const formatWeekBucketLabel = (bucket: string): string => {
  const start = parseBucketDate(bucket);
  return `Week of ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

export const formatMonthBucketLabel = (bucket: string): string => {
  const start = parseBucketDate(bucket);
  return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

export const exerciseRepsPart = (exercise: StoredExercise): number => {
  if ('unit' in exercise && exercise.unit === 'reps') return exercise.amount;
  if ('reps' in exercise && typeof exercise.reps === 'number') return exercise.reps;
  return 0;
};

export const exerciseTimedSecondsPart = (exercise: StoredExercise): number => {
  if ('unit' in exercise && exercise.unit === 'seconds') return exercise.amount;
  if ('unit' in exercise && exercise.unit === 'minutes') return exercise.amount * 60;
  return 0;
};

export const sumExerciseVolume = (exercises: StoredExercise[]): { reps: number; timedSeconds: number } => exercises.reduce(
  (acc, exercise) => ({
    reps: acc.reps + exerciseRepsPart(exercise),
    timedSeconds: acc.timedSeconds + exerciseTimedSecondsPart(exercise)
  }),
  { reps: 0, timedSeconds: 0 }
);

export const resolveAllowedWorkoutIds = (allowedWorkoutIds: string[]): string[] => {
  const validWorkoutIds = new Set(DEFAULT_ALLOWED_WORKOUT_IDS);
  const filtered = allowedWorkoutIds.filter((id) => validWorkoutIds.has(id));
  return filtered.length > 0 ? filtered : DEFAULT_ALLOWED_WORKOUT_IDS;
};

export { STRETCH_DEFAULT_SECONDS } from '@/lib/workoutCustomize';

export type StretchBodyRegion = 'upper' | 'lower';

/** Stretch ids rolled into Today's movement (not per-move rows). */
export const STRETCH_UPPER_BODY_IDS = new Set<string>([
  'stretch-neck-roll',
  'stretch-lateral-shoulder-L',
  'stretch-lateral-shoulder-R',
  'arm-rolls'
]);

export const STRETCH_LOWER_BODY_IDS = new Set<string>([
  'stretch-butterfly',
  'stretch-hip-roll',
  'stretch-foot',
  'stretch-toe-both',
  'stretch-toe-one-L',
  'stretch-toe-one-R',
  'stretch-deep-squat',
  'stretch-quad-standing-L',
  'stretch-quad-standing-R',
  'stretch-forward-hang'
]);

export const stretchBodyRegionForId = (id: string): StretchBodyRegion | null => {
  if (STRETCH_UPPER_BODY_IDS.has(id)) return 'upper';
  if (STRETCH_LOWER_BODY_IDS.has(id)) return 'lower';
  return null;
};

export const isStretchExerciseId = (id: string): boolean => stretchBodyRegionForId(id) !== null;

/** Strength/move counters for today — stretch moves are rolled up separately, not listed per-move. */
export const listTodayWorkoutExerciseTotals = (totals: Record<string, ExerciseRunAgg>): ExerciseRunAgg[] =>
  listNonZeroExerciseTotals(totals).filter((agg) => !isStretchExerciseId(agg.id));

/** Exercises plus upper/lower stretch rollups for the Daily movement totals list. */
export const listTodayMovementTotals = (
  exerciseTotals: Record<string, ExerciseRunAgg>,
  stretchTotals: TodayStretchTotals
): ExerciseRunAgg[] => {
  const rows: ExerciseRunAgg[] = [...listTodayWorkoutExerciseTotals(exerciseTotals)];
  if (stretchTotals.upperBodySeconds > 0) {
    rows.push({
      id: '__stretch-upper',
      label: DASHBOARD_TODAY_STRETCH_ROWS[0].label,
      reps: 0,
      timedSeconds: stretchTotals.upperBodySeconds
    });
  }
  if (stretchTotals.lowerBodySeconds > 0) {
    rows.push({
      id: '__stretch-lower',
      label: DASHBOARD_TODAY_STRETCH_ROWS[1].label,
      reps: 0,
      timedSeconds: stretchTotals.lowerBodySeconds
    });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
};

export interface TodayStretchTotals {
  upperBodySeconds: number;
  lowerBodySeconds: number;
}

export const summarizeTodayStretchTotals = (
  logs: WorkoutLogEntry[],
  nowTimestamp: number = Date.now(),
  rolloverHour: number = DEFAULT_DAY_ROLLOVER_HOUR
): TodayStretchTotals => {
  const { startTs, endTs } = getStatsDayWindow(nowTimestamp, rolloverHour);
  let upperBodySeconds = 0;
  let lowerBodySeconds = 0;
  logs.forEach((log) => {
    if (log.completedAt < startTs || log.completedAt >= endTs) return;
    (log.exercises ?? []).forEach((ex) => {
      const region = stretchBodyRegionForId(ex.id);
      if (!region) return;
      const sec = exerciseTimedSecondsPart(ex);
      if (region === 'upper') upperBodySeconds += sec;
      else lowerBodySeconds += sec;
    });
  });
  return { upperBodySeconds, lowerBodySeconds };
};

export const formatTimedSecondsTotal = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  if (s <= 0) return '0';
  if (s % 60 === 0 && s >= 60) return `${s / 60} min`;
  return `${s}s`;
};

export const DASHBOARD_TODAY_STRETCH_ROWS = [
  { region: 'upper' as const, label: 'Upper body stretching' },
  { region: 'lower' as const, label: 'Lower body stretching' }
] as const;

/** L/R stretch ids — if one side appears in a break, the other must too. */
export const STRETCH_BILATERAL_PAIRS: readonly (readonly [string, string])[] = [
  ['stretch-toe-one-L', 'stretch-toe-one-R'],
  ['stretch-lateral-shoulder-L', 'stretch-lateral-shoulder-R'],
  ['stretch-quad-standing-L', 'stretch-quad-standing-R']
];

const STRETCH_POOL: StretchPick[] = STRETCH_PICK_CATALOG.map((row) => row.pick);

const stretchCatalogKeyForPick = (pick: StretchPick): string | null => {
  for (const row of STRETCH_PICK_CATALOG) {
    if (row.pick.kind === 'single' && pick.kind === 'single' && row.pick.id === pick.id) return row.key;
    if (row.pick.kind === 'bilateral' && pick.kind === 'bilateral' && row.pick.left.id === pick.left.id) return row.key;
  }
  return null;
};

const stretchRow = (id: string, name: string, holdSeconds: number = STRETCH_DEFAULT_SECONDS): ExerciseDefinition => ({
  id,
  name,
  amount: holdSeconds,
  unit: 'seconds'
});

export const stretchPickToExercises = (pick: StretchPick, holdSeconds: number = STRETCH_DEFAULT_SECONDS): ExerciseDefinition[] => {
  if (pick.kind === 'single') return [stretchRow(pick.id, pick.name, holdSeconds)];
  return [stretchRow(pick.left.id, pick.left.name, holdSeconds), stretchRow(pick.right.id, pick.right.name, holdSeconds)];
};

export const workoutBilateralPairsComplete = (exercises: ExerciseDefinition[]): boolean => {
  const ids = new Set(exercises.map((e) => e.id));
  return STRETCH_BILATERAL_PAIRS.every(([left, right]) => ids.has(left) === ids.has(right));
};

type BreakMoveUnit = { exerciseIds: string[]; exercises: ExerciseDefinition[] };

const stretchPickToUnit = (pick: StretchPick, holdSeconds: number, overrides: Record<string, { amount: number; unit: ExerciseUnit }>): BreakMoveUnit => {
  const exercises = stretchPickToExercises(pick, holdSeconds).map((ex) => applyExerciseOverride(ex, overrides));
  return { exerciseIds: exercises.map((e) => e.id), exercises };
};

const shuffleStretchPool = (randomValue: number): StretchPick[] => {
  const arr = [...STRETCH_POOL];
  let seed = Math.floor(randomValue * 1e9) % 1000000007;
  const rnd = () => {
    seed = (seed * 48271 + 1) % 1000000007;
    return seed / 1000000007;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/** 2–3 stretch rows; bilateral picks always schedule left and right. */
export const buildStretchBreakExercises = (
  randomValue: number = Math.random(),
  prefs: WorkoutCustomizePrefs = defaultWorkoutCustomizePrefs()
): ExerciseDefinition[] => {
  const holdForPick = (pick: StretchPick) => {
    const key = stretchCatalogKeyForPick(pick);
    return key ? stretchHoldSecondsForPickKey(key, prefs) : STRETCH_DEFAULT_SECONDS;
  };
  const rowTarget = (() => {
    const r = Number.isFinite(randomValue) ? Math.abs(Math.sin(randomValue * 9999)) : Math.random();
    return r < 0.5 ? 2 : 3;
  })();
  const pool = shuffleStretchPool(randomValue);
  const out: ExerciseDefinition[] = [];
  const usedPickKeys = new Set<string>();
  const pickKey = (pick: StretchPick) => (pick.kind === 'single' ? pick.id : `${pick.left.id}|${pick.right.id}`);
  for (const pick of pool) {
    if (out.length >= rowTarget) break;
    const rows = stretchPickToExercises(pick, holdForPick(pick));
    if (out.length + rows.length > rowTarget || usedPickKeys.has(pickKey(pick))) continue;
    usedPickKeys.add(pickKey(pick));
    rows.forEach((row) => out.push(row));
  }
  for (const pick of STRETCH_POOL) {
    if (out.length >= rowTarget) break;
    const rows = stretchPickToExercises(pick, holdForPick(pick));
    if (out.length + rows.length > rowTarget || usedPickKeys.has(pickKey(pick))) continue;
    usedPickKeys.add(pickKey(pick));
    rows.forEach((row) => out.push(row));
  }
  return out;
};

export const estimateExerciseLoadSeconds = (ex: ExerciseDefinition): number => {
  if (ex.unit === 'seconds') return ex.amount;
  if (ex.unit === 'minutes') return ex.amount * 60;
  let perRep = 2.5;
  if (ex.id === 'pushups') perRep = 3.5;
  if (ex.id === 'jacks') perRep = 2;
  if (ex.id === 'squats') perRep = 2;
  return Math.round(ex.amount * perRep);
};

const collectBreakMoveUnits = (prefs: WorkoutCustomizePrefs): BreakMoveUnit[] => {
  const allowedWorkouts = new Set(prefs.allowedWorkoutIds);
  const allowedStretchKeys = new Set(prefs.allowedStretchPickKeys);
  const overrides = prefs.exerciseOverrides;
  const units: BreakMoveUnit[] = [];
  for (const def of PREDEFINED_WORKOUTS) {
    if (def.id === 'stretch-mobility') continue;
    if (!allowedWorkouts.has(def.id)) continue;
    def.exercises.forEach((ex) => {
      const merged = applyExerciseOverride(ex, overrides);
      units.push({ exerciseIds: [merged.id], exercises: [merged] });
    });
  }
  STRETCH_PICK_CATALOG.forEach((row) => {
    if (!allowedStretchKeys.has(row.key)) return;
    const holdSeconds = stretchHoldSecondsForPickKey(row.key, prefs);
    units.push(stretchPickToUnit(row.pick, holdSeconds, overrides));
  });
  prefs.customExercises.forEach((ex) => {
    const merged = applyExerciseOverride(ex, overrides);
    units.push({ exerciseIds: [merged.id], exercises: [merged] });
  });
  return units;
};

/** Quick-add rows on Dashboard (today totals + manual increment). */
export const DASHBOARD_MANUAL_EXERCISES: readonly ExerciseDefinition[] = [
  { id: 'pushups', name: 'Push-ups', amount: 5, unit: 'reps' },
  { id: 'jacks', name: 'Jumping jacks', amount: 10, unit: 'reps' },
  { id: 'squats', name: 'Air squats', amount: 5, unit: 'reps' },
  { id: 'march', name: 'Marching in place', amount: 1, unit: 'minutes' },
  { id: 'shadow', name: 'Shadowboxing', amount: 30, unit: 'seconds' }
];

/** Random 2–3 min circuit: one row per move id from everything you allow in Customize. */
export const buildMixedBreakWorkout = (prefs: WorkoutCustomizePrefs, randomValue: number = Math.random()): WorkoutDefinition => {
  let units = collectBreakMoveUnits(prefs);
  if (units.length === 0) units = collectBreakMoveUnits(defaultWorkoutCustomizePrefs());
  let seed = Math.floor(Number.isFinite(randomValue) ? Math.abs(randomValue * 1e9) % 1000000007 : Math.random() * 1e9) % 1000000007;
  const rnd = () => {
    seed = (seed * 48271 + 1) % 1000000007;
    return seed / 1000000007;
  };
  const safe01 = Number.isFinite(randomValue) ? Math.abs(Math.sin(randomValue * 8888)) % 1 : Math.random();
  const targetSec = 120 + Math.floor(safe01 * 61);
  const selected: ExerciseDefinition[] = [];
  const usedIds = new Set<string>();
  const pickUniqueUnit = (): BreakMoveUnit | null => {
    const pool = units.filter((u) => u.exerciseIds.every((id) => !usedIds.has(id)));
    if (pool.length === 0) return null;
    return pool[Math.floor(rnd() * pool.length)];
  };
  const addUnit = (unit: BreakMoveUnit) => {
    unit.exerciseIds.forEach((id) => usedIds.add(id));
    unit.exercises.forEach((ex) => {
      selected.push({ ...ex });
      sum += estimateExerciseLoadSeconds(ex);
    });
  };
  let sum = 0;
  while (sum < targetSec && selected.length < 30) {
    const unit = pickUniqueUnit();
    if (!unit) break;
    addUnit(unit);
  }
  while (sum < 110 && selected.length < 36) {
    const unit = pickUniqueUnit();
    if (!unit) break;
    addUnit(unit);
  }
  const totalLoad = selected.reduce((s, e) => s + estimateExerciseLoadSeconds(e), 0);
  const estimatedMinutes = Math.min(3, Math.max(2, Math.round(totalLoad / 60) || 2));
  return {
    id: 'mixed-break',
    name: '🎲 Mixed break',
    estimatedMinutes,
    exercises: selected
  };
};

export const pickWorkoutForBreak = (prefs: WorkoutCustomizePrefs, randomValue: number = Math.random()): WorkoutDefinition =>
  buildMixedBreakWorkout(prefs, randomValue);

/** Build prefs from legacy allowed_workout_ids KV only. */
export const workoutPrefsFromAllowedIds = (allowedWorkoutIds: string[]): WorkoutCustomizePrefs =>
  normalizeWorkoutCustomizePrefs(null, allowedWorkoutIds);

const logTimedSeconds = (log: WorkoutLogEntry): number => {
  if (typeof log.totalTimedSeconds === 'number') return log.totalTimedSeconds;
  return sumExerciseVolume(log.exercises).timedSeconds;
};

export const summarizeWorkoutLogs = (logs: WorkoutLogEntry[], _nowTimestamp: number = Date.now()): WorkoutTotals => {
  let totalReps = 0; let totalTimedSeconds = 0;
  const weeklyMap = new Map<string, TimeSeriesPoint>();
  const monthlyMap = new Map<string, TimeSeriesPoint>();
  logs.forEach((log) => {
    const timed = logTimedSeconds(log);
    totalReps += log.totalReps;
    totalTimedSeconds += timed;
    const weekBucket = toWeekBucket(log.completedAt);
    const monthBucket = toMonthBucket(new Date(log.completedAt));
    const weekPoint = weeklyMap.get(weekBucket) || { bucket: weekBucket, reps: 0, timedSeconds: 0, workouts: 0 };
    weekPoint.reps += log.totalReps; weekPoint.timedSeconds += timed; weekPoint.workouts += 1; weeklyMap.set(weekBucket, weekPoint);
    const monthPoint = monthlyMap.get(monthBucket) || { bucket: monthBucket, reps: 0, timedSeconds: 0, workouts: 0 };
    monthPoint.reps += log.totalReps; monthPoint.timedSeconds += timed; monthPoint.workouts += 1; monthlyMap.set(monthBucket, monthPoint);
  });
  const weekly = [...weeklyMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-8);
  const monthly = [...monthlyMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-6);
  return {
    totalReps,
    totalTimedSeconds,
    totalWorkouts: logs.length,
    weekly,
    monthly
  };
};

export interface FocusPeriodTotals {
  totalPomodoros: number;
  totalDeepWork: number;
  totalFocusMinutes: number;
  weekly: FocusTimeSeriesPoint[];
  monthly: FocusTimeSeriesPoint[];
}

export interface FocusTodayTotals {
  todayPomodoros: number;
  todayDeepWork: number;
}

export const countTodayDeepWorkSessions = (
  logs: FocusLogEntry[],
  nowTimestamp: number = Date.now(),
  rolloverHour: number = DEFAULT_DAY_ROLLOVER_HOUR
): number => {
  const { startTs, endTs } = getStatsDayWindow(nowTimestamp, rolloverHour);
  return logs.filter((entry) => entry.type === 'deep' && entry.completedAt >= startTs && entry.completedAt < endTs && focusEntryCountsAsSession(entry)).length;
};

export const countTodayPomodoroSessions = (
  logs: FocusLogEntry[],
  nowTimestamp: number = Date.now(),
  rolloverHour: number = DEFAULT_DAY_ROLLOVER_HOUR
): number => {
  const { startTs, endTs } = getStatsDayWindow(nowTimestamp, rolloverHour);
  return logs.filter((entry) => entry.type === 'pomodoro' && entry.completedAt >= startTs && entry.completedAt < endTs && focusEntryCountsAsSession(entry)).length;
};

/** Weekly/monthly/all-time rollups for Stats; calendar week/month buckets (rollover hour N/A). */
export const summarizeFocusLogs = (logs: FocusLogEntry[]): FocusPeriodTotals => {
  let totalPomodoros = 0;
  let totalDeepWork = 0;
  let totalFocusMinutes = 0;
  const weeklyMap = new Map<string, FocusTimeSeriesPoint>();
  const monthlyMap = new Map<string, FocusTimeSeriesPoint>();
  const bumpFocusPoint = (map: Map<string, FocusTimeSeriesPoint>, bucket: string, entry: FocusLogEntry) => {
    const point = map.get(bucket) || { bucket, pomodoros: 0, deepWork: 0, focusMinutes: 0 };
    point.focusMinutes += entry.durationMinutes;
    if (focusEntryCountsAsSession(entry)) {
      if (entry.type === 'pomodoro') point.pomodoros += 1;
      else point.deepWork += 1;
    }
    map.set(bucket, point);
  };
  logs.forEach((entry) => {
    totalFocusMinutes += entry.durationMinutes;
    bumpFocusPoint(weeklyMap, toWeekBucket(entry.completedAt), entry);
    bumpFocusPoint(monthlyMap, toMonthBucket(new Date(entry.completedAt)), entry);
    if (focusEntryCountsAsSession(entry)) {
      if (entry.type === 'pomodoro') totalPomodoros += 1;
      else totalDeepWork += 1;
    }
  });
  const weekly = [...weeklyMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-8);
  const monthly = [...monthlyMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-6);
  return {
    totalPomodoros,
    totalDeepWork,
    totalFocusMinutes,
    weekly,
    monthly
  };
};

export const summarizeFocusToday = (
  logs: FocusLogEntry[],
  nowTimestamp: number = Date.now(),
  rolloverHour: number
): FocusTodayTotals => ({
  todayPomodoros: countTodayPomodoroSessions(logs, nowTimestamp, rolloverHour),
  todayDeepWork: countTodayDeepWorkSessions(logs, nowTimestamp, rolloverHour)
});

export const mergePeriodStats = (workoutPoints: TimeSeriesPoint[], focusPoints: FocusTimeSeriesPoint[]): PeriodStatsPoint[] => {
  const map = new Map<string, PeriodStatsPoint>();
  const ensure = (bucket: string): PeriodStatsPoint =>
    map.get(bucket) || { bucket, pomodoros: 0, deepWork: 0, focusMinutes: 0, reps: 0, timedSeconds: 0, workouts: 0 };
  workoutPoints.forEach((p) => {
    const point = ensure(p.bucket);
    point.reps += p.reps;
    point.timedSeconds += p.timedSeconds;
    point.workouts += p.workouts;
    map.set(p.bucket, point);
  });
  focusPoints.forEach((p) => {
    const point = ensure(p.bucket);
    point.pomodoros += p.pomodoros;
    point.deepWork += p.deepWork;
    point.focusMinutes += p.focusMinutes;
    map.set(p.bucket, point);
  });
  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
};

export const RECENT_WEEK_COUNT = 8;
export const RECENT_MONTH_COUNT = 6;

const emptyPeriodPoint = (bucket: string): PeriodStatsPoint => ({
  bucket, pomodoros: 0, deepWork: 0, focusMinutes: 0, reps: 0, timedSeconds: 0, workouts: 0
});

export const recentWeekBucketKeys = (nowTimestamp: number = Date.now(), count: number = RECENT_WEEK_COUNT): string[] => {
  const currentMonday = parseBucketDate(toWeekBucket(nowTimestamp));
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() - i * 7);
    keys.push(toDateBucket(d));
  }
  return keys;
};

export const recentMonthBucketKeys = (nowTimestamp: number = Date.now(), count: number = RECENT_MONTH_COUNT): string[] => {
  const now = new Date(nowTimestamp);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(toMonthBucket(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return keys;
};

export const fillPeriodSeries = (buckets: string[], points: PeriodStatsPoint[]): PeriodStatsPoint[] => {
  const map = new Map(points.map((p) => [p.bucket, p]));
  return buckets.map((bucket) => {
    const existing = map.get(bucket);
    return existing ? { ...existing } : emptyPeriodPoint(bucket);
  });
};

export const formatWeekChartLabel = (bucket: string): string =>
  parseBucketDate(bucket).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const formatMonthChartLabel = (bucket: string): string =>
  parseBucketDate(bucket).toLocaleDateString(undefined, { month: 'short' });

/** Movement minutes (from timed seconds) for period progress charts. */
export const periodMoveMinutes = (point: PeriodStatsPoint): number => Math.round(point.timedSeconds / 60);

export const formatTimedMovementHeadline = (totalSeconds: number): string => {
  const sec = Math.max(0, Math.round(totalSeconds));
  if (sec === 0) return '0m';
  const h = Math.floor(sec / 3600);
  let m = Math.round((sec % 3600) / 60);
  if (m === 60) { m = 0; }
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

export const formatClock = (totalSeconds: number): string => {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = `${Math.floor(safeSeconds / 60)}`.padStart(2, '0');
  const seconds = `${safeSeconds % 60}`.padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const formatWallTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatExerciseAmount = (exercise: StoredExercise): string => {
  if ('unit' in exercise && exercise.unit === 'reps') return `${exercise.amount} reps`;
  if ('unit' in exercise && (exercise.unit === 'seconds' || exercise.unit === 'minutes')) {
    return formatTimedDuration(exerciseTimedSecondsPart(exercise));
  }
  if ('reps' in exercise && typeof exercise.reps === 'number') return `${exercise.reps} reps`;
  return '';
};

export type { ExerciseRunAgg } from '@mgmt/core';

export const summarizeTodayExerciseTotals = (
  logs: WorkoutLogEntry[],
  nowTimestamp: number = Date.now(),
  rolloverHour: number = DEFAULT_DAY_ROLLOVER_HOUR
): Record<string, ExerciseRunAgg> => {
  const { startTs, endTs } = getStatsDayWindow(nowTimestamp, rolloverHour);
  let totals: Record<string, ExerciseRunAgg> = {};
  logs.forEach((log) => {
    if (log.completedAt < startTs || log.completedAt >= endTs) return;
    const defs = (log.exercises ?? []).filter((e): e is ExerciseDefinition => 'unit' in e);
    totals = mergeWorkoutExercisesIntoTotals(totals, defs);
  });
  return totals;
};

export const buildManualExerciseLogEntry = (
  exercise: ExerciseDefinition,
  id: string,
  completedAt: number = Date.now()
): WorkoutLogEntry => {
  const vol = sumExerciseVolume([exercise]);
  return {
    id,
    workoutId: 'manual',
    workoutName: '✋ Manual',
    completedAt,
    exercises: [exercise],
    totalReps: vol.reps,
    totalTimedSeconds: vol.timedSeconds,
    completionRatio: 1
  };
};

export const mergeWorkoutExercisesIntoTotals = (
  prev: Record<string, ExerciseRunAgg>,
  exercises: ExerciseDefinition[]
): Record<string, ExerciseRunAgg> => {
  const next = { ...prev };
  exercises.forEach((ex) => {
    const r = exerciseRepsPart(ex);
    const t = exerciseTimedSecondsPart(ex);
    const cur = next[ex.id];
    next[ex.id] = cur
      ? { ...cur, label: ex.name, reps: cur.reps + r, timedSeconds: cur.timedSeconds + t }
      : { id: ex.id, label: ex.name, reps: r, timedSeconds: t };
  });
  return next;
};

export const formatExerciseRunAggLine = (agg: ExerciseRunAgg): string => {
  const parts: string[] = [];
  if (agg.reps > 0) parts.push(String(agg.reps));
  if (agg.timedSeconds > 0) parts.push(formatTimedDuration(agg.timedSeconds));
  if (parts.length === 0) return `${agg.label}: 0`;
  return `${agg.label}: ${parts.join(' · ')}`;
};

export const summarizeExerciseTotalsInRange = (
  logs: WorkoutLogEntry[],
  startTs: number,
  endTs: number
): Record<string, ExerciseRunAgg> => {
  let totals: Record<string, ExerciseRunAgg> = {};
  logs.forEach((log) => {
    if (log.completedAt < startTs || log.completedAt >= endTs) return;
    const defs = (log.exercises ?? []).filter((e): e is ExerciseDefinition => 'unit' in e);
    totals = mergeWorkoutExercisesIntoTotals(totals, defs);
  });
  return totals;
};

export const summarizeExerciseTotalsForWeekBucket = (logs: WorkoutLogEntry[], bucket: string): Record<string, ExerciseRunAgg> => {
  const { startTs, endTs } = weekBucketRange(bucket);
  return summarizeExerciseTotalsInRange(logs, startTs, endTs);
};

export const summarizeExerciseTotalsForMonthBucket = (logs: WorkoutLogEntry[], bucket: string): Record<string, ExerciseRunAgg> => {
  const { startTs, endTs } = monthBucketRange(bucket);
  return summarizeExerciseTotalsInRange(logs, startTs, endTs);
};

export const summarizeExerciseTotalsAllTime = (logs: WorkoutLogEntry[]): Record<string, ExerciseRunAgg> => {
  let totals: Record<string, ExerciseRunAgg> = {};
  logs.forEach((log) => {
    const defs = (log.exercises ?? []).filter((e): e is ExerciseDefinition => 'unit' in e);
    totals = mergeWorkoutExercisesIntoTotals(totals, defs);
  });
  return totals;
};

export const listNonZeroExerciseTotals = (totals: Record<string, ExerciseRunAgg>): ExerciseRunAgg[] =>
  Object.values(totals)
    .filter((agg) => agg.reps > 0 || agg.timedSeconds > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
