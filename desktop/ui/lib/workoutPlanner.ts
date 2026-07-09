/** Barrel: session types, catalogs, break planning, stats. */
export * from './workoutTypes';
export * from './workoutCatalogs';
export * from './sessionStats';

import {
  applyExerciseOverride,
  defaultWorkoutCustomizePrefs,
  normalizeWorkoutCustomizePrefs,
  stretchHoldSecondsForPickKey,
  STRETCH_DEFAULT_SECONDS,
  type WorkoutCustomizePrefs
} from '@/lib/workoutCustomize';
import type { ExerciseRunAgg } from '@mgmt/core';
import { DEFAULT_DAY_ROLLOVER_HOUR, getStatsDayWindow } from '@/lib/dayBoundary';
import {
  DEFAULT_ALLOWED_WORKOUT_IDS,
  PREDEFINED_WORKOUTS,
  STRETCH_PICK_CATALOG,
  type StretchPick
} from './workoutCatalogs';
import {
  type ExerciseDefinition,
  type ExerciseUnit,
  type WorkoutDefinition,
  type WorkoutLogEntry
} from './workoutTypes';
import {
  exerciseTimedSecondsPart,
  listNonZeroExerciseTotals,
  sumExerciseVolume
} from './sessionStats';

export { STRETCH_DEFAULT_SECONDS } from '@/lib/workoutCustomize';

export const resolveAllowedWorkoutIds = (allowedWorkoutIds: string[]): string[] => {
  const validWorkoutIds = new Set(DEFAULT_ALLOWED_WORKOUT_IDS);
  const filtered = allowedWorkoutIds.filter((id) => validWorkoutIds.has(id));
  return filtered.length > 0 ? filtered : [...DEFAULT_ALLOWED_WORKOUT_IDS];
};

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

export interface TodayStretchTotals {
  upperBodySeconds: number;
  lowerBodySeconds: number;
}

export const DASHBOARD_TODAY_STRETCH_ROWS = [
  { region: 'upper' as const, label: 'Upper body stretching' },
  { region: 'lower' as const, label: 'Lower body stretching' }
] as const;

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

