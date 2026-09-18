export type { WorkoutCustomizePrefs } from '@/lib/workoutCustomize';
export type { ExerciseRunAgg } from '@mgmt/core';

export type SessionType = 'pomodoro' | 'deep';
export type ExerciseUnit = 'reps' | 'seconds' | 'minutes';

export interface ExerciseRepRange {
  min: number;
  max: number;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  amount: number;
  unit: ExerciseUnit;
  repRange?: ExerciseRepRange;
  currentProgression?: string;
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
  movementSnack?: {
    day: string;
    slotId: string;
    kind: 'build' | 'move';
    setNumber: number;
    setCount: number;
  };
}

export interface FocusLogEntry {
  id: string;
  type: SessionType;
  completedAt: number;
  durationMinutes: number;
  plannedDurationMinutes: number;
  completionRatio: number;
}

export const SESSION_COUNT_MIN_RATIO = 0.75;

export const focusEntryCountsAsSession = (entry: FocusLogEntry): boolean =>
  (entry.completionRatio ?? 1) >= SESSION_COUNT_MIN_RATIO;

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

export { SESSION_DURATIONS_MINUTES } from '@mgmt/core';
