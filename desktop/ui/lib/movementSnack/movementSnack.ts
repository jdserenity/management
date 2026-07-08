import { DEFAULT_DAY_ROLLOVER_HOUR, getStatsDayWindow } from '@/lib/dayBoundary';
import {
  sumExerciseVolume,
  type ExerciseDefinition,
  type WorkoutLogEntry
} from '@/lib/workoutPlanner';

export const MOVEMENT_SNACK_HARD_WORKOUT_ID = 'movement-snack';
export const MOVEMENT_SNACK_EASY_WORKOUT_ID = 'movement-snack-easy';
/** @deprecated alias — hard snacks only */
export const MOVEMENT_SNACK_WORKOUT_ID = MOVEMENT_SNACK_HARD_WORKOUT_ID;
export const MOVEMENT_SNACK_WORKOUT_NAME = 'Movement snack';

export interface MovementSnackPrefs {
  dailyGoal: number;
  hardExercises: ExerciseDefinition[];
  easyExercises: ExerciseDefinition[];
}

export const defaultMovementSnackHardExercises = (): ExerciseDefinition[] => [
  { id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' },
  { id: 'squats', name: 'Air squats', amount: 20, unit: 'reps' },
  { id: 'reverse-crunches', name: 'Reverse crunches', amount: 11, unit: 'reps' },
];

export const defaultMovementSnackEasyExercises = (): ExerciseDefinition[] => [
  { id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' },
  { id: 'reverse-lunges', name: 'Reverse lunges', amount: 10, unit: 'reps' },
  { id: 'plank', name: 'Plank', amount: 25, unit: 'seconds' },
];

export const defaultMovementSnackPrefs = (): MovementSnackPrefs => ({
  dailyGoal: 6,
  hardExercises: defaultMovementSnackHardExercises(),
  easyExercises: defaultMovementSnackEasyExercises(),
});

export const normalizeMovementSnackPrefs = (
  raw: Partial<MovementSnackPrefs> | null | undefined
): MovementSnackPrefs => {
  const base = defaultMovementSnackPrefs();
  if (!raw) return base;

  const parseGoal = (): number => {
    if (!Number.isFinite(raw.dailyGoal)) return base.dailyGoal;
    const n = Math.round(raw.dailyGoal!);
    return n > 0 ? n : base.dailyGoal;
  };

  const parseExercises = (arr: unknown): ExerciseDefinition[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter((e): e is ExerciseDefinition =>
      e &&
      typeof (e as ExerciseDefinition).id === 'string' &&
      typeof (e as ExerciseDefinition).name === 'string' &&
      typeof (e as ExerciseDefinition).unit === 'string' &&
      Number.isFinite((e as ExerciseDefinition).amount) &&
      ((e as ExerciseDefinition).unit === 'reps' || (e as ExerciseDefinition).unit === 'seconds' || (e as ExerciseDefinition).unit === 'minutes')
    );
  };

  const hardExercises = parseExercises(raw.hardExercises);
  const easyExercises = parseExercises(raw.easyExercises);

  return {
    dailyGoal: parseGoal(),
    hardExercises: hardExercises.length > 0 ? hardExercises : base.hardExercises,
    easyExercises: easyExercises.length > 0 ? easyExercises : base.easyExercises,
  };
};

export const movementSnackLogLabel = (easy: boolean): string =>
  easy ? `${MOVEMENT_SNACK_WORKOUT_NAME} · easy` : `${MOVEMENT_SNACK_WORKOUT_NAME} · hard`;

export const isHardMovementSnackLog = (log: Pick<WorkoutLogEntry, 'workoutId' | 'workoutName'>): boolean =>
  log.workoutId === MOVEMENT_SNACK_HARD_WORKOUT_ID && !log.workoutName.includes('· easy');

export const isEasyMovementSnackLog = (log: Pick<WorkoutLogEntry, 'workoutId' | 'workoutName'>): boolean =>
  log.workoutId === MOVEMENT_SNACK_EASY_WORKOUT_ID ||
  (log.workoutId === MOVEMENT_SNACK_HARD_WORKOUT_ID && log.workoutName.includes('· easy'));

export const buildMovementSnackLogEntry = (
  exercises: ExerciseDefinition[],
  id: string,
  completedAt: number = Date.now(),
  easy: boolean = false
): WorkoutLogEntry => {
  const vol = sumExerciseVolume(exercises);
  return {
    id,
    workoutId: easy ? MOVEMENT_SNACK_EASY_WORKOUT_ID : MOVEMENT_SNACK_HARD_WORKOUT_ID,
    workoutName: movementSnackLogLabel(easy),
    completedAt,
    exercises: [...exercises],
    totalReps: vol.reps,
    totalTimedSeconds: vol.timedSeconds,
    completionRatio: 1,
  };
};

export const movementSnackLogsToday = (
  logs: WorkoutLogEntry[],
  nowTimestamp = Date.now(),
  rolloverHour = DEFAULT_DAY_ROLLOVER_HOUR
): WorkoutLogEntry[] => {
  const { startTs, endTs } = getStatsDayWindow(nowTimestamp, rolloverHour);
  return logs.filter(
    (log) =>
      (log.workoutId === MOVEMENT_SNACK_HARD_WORKOUT_ID || log.workoutId === MOVEMENT_SNACK_EASY_WORKOUT_ID) &&
      log.completedAt >= startTs &&
      log.completedAt < endTs
  );
};

export const countMovementSnacksToday = (
  logs: WorkoutLogEntry[],
  nowTimestamp = Date.now(),
  rolloverHour = DEFAULT_DAY_ROLLOVER_HOUR
): number => movementSnackLogsToday(logs, nowTimestamp, rolloverHour).length;

export const hardMovementSnackLogsToday = (
  logs: WorkoutLogEntry[],
  nowTimestamp = Date.now(),
  rolloverHour = DEFAULT_DAY_ROLLOVER_HOUR
): WorkoutLogEntry[] => movementSnackLogsToday(logs, nowTimestamp, rolloverHour).filter(isHardMovementSnackLog);
