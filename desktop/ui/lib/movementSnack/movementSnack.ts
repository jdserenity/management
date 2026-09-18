import { DEFAULT_DAY_ROLLOVER_HOUR, getStatsDayWindow } from '@/lib/dayBoundary';
import {
  sumExerciseVolume,
  type ExerciseDefinition,
  type ExerciseRepRange,
  type WorkoutLogEntry
} from '@/lib/workoutPlanner';
import { cloneQuickLogDefaults } from './quickLogDefaults';
import { STRETCH_PICK_CATALOG } from '@/lib/workoutCatalogs';

export const MOVEMENT_SNACK_HARD_WORKOUT_ID = 'movement-snack';
export const MOVEMENT_SNACK_EASY_WORKOUT_ID = 'movement-snack-easy';
/** @deprecated alias — hard snacks only */
export const MOVEMENT_SNACK_WORKOUT_ID = MOVEMENT_SNACK_HARD_WORKOUT_ID;
export const MOVEMENT_SNACK_WORKOUT_NAME = 'Movement burst';

export type MovementSnackKind = 'build' | 'move';
export type BuildSnackSlot = 'build-push' | 'build-abs' | 'build-pull' | 'build-legs';
export type MoveSnackSlot = 'move-1' | 'move-2' | 'move-3' | 'move-4';
export type MovementSnackSlot = BuildSnackSlot | MoveSnackSlot;
export type MovementWeekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface MovementSnackTask {
  slotId: MovementSnackSlot;
  kind: MovementSnackKind;
  label: string;
  exercise: ExerciseDefinition;
  setCount: number;
}

export type MovementSnackRegimen = Record<MovementWeekday, MovementSnackTask[]>;

const BUILD_EXERCISES: Record<BuildSnackSlot, ExerciseDefinition> = {
  'build-push': { id: 'pushups', name: 'Push-ups', amount: 8, unit: 'reps', repRange: { min: 8, max: 20 }, currentProgression: 'Incline' },
  'build-abs': { id: 'reverse-crunches', name: 'Reverse crunches', amount: 10, unit: 'reps', repRange: { min: 10, max: 20 }, currentProgression: 'Bodyweight' },
  'build-pull': { id: 'pullups', name: 'Pull-ups', amount: 3, unit: 'reps', repRange: { min: 3, max: 8 }, currentProgression: 'Assisted' },
  'build-legs': { id: 'single-leg-sit-to-stand', name: 'Single-leg sit-to-stand', amount: 6, unit: 'reps', repRange: { min: 6, max: 15 }, currentProgression: 'Weighted' }
};

export const MOVEMENT_WEEKDAYS: readonly MovementWeekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES: readonly MovementWeekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REMOVED_EXERCISE_IDS = new Set(['shadow', 'reverse-lunges']);

export const defaultMovementSnackMobilityPool = (): ExerciseDefinition[] => STRETCH_PICK_CATALOG.map((row) => ({
  id: row.key, name: row.label, amount: 20, unit: 'seconds'
}));

export const defaultMovementSnackBuildPool = (): ExerciseDefinition[] => [
  { ...BUILD_EXERCISES['build-push'] }, { ...BUILD_EXERCISES['build-abs'] },
  { ...BUILD_EXERCISES['build-pull'] }, { ...BUILD_EXERCISES['build-legs'] }
];

const normalizeRepRange = (value: unknown, unit: ExerciseDefinition['unit']): ExerciseRepRange | undefined => {
  if (unit !== 'reps' || !value || typeof value !== 'object') return undefined;
  const raw = value as Partial<ExerciseRepRange>;
  const min = Number(raw.min); const max = Number(raw.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return undefined;
  return { min: Math.round(min), max: Math.round(max) };
};

export const movementSnackDayKey = (timestamp: number = Date.now(), rolloverHour = DEFAULT_DAY_ROLLOVER_HOUR): string => {
  const date = new Date(getStatsDayWindow(timestamp, rolloverHour).startTs);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
};

const buildSlotsForDay = (day: MovementWeekday): BuildSnackSlot[] => ({
  Mon: ['build-push', 'build-abs'], Tue: ['build-pull', 'build-legs'], Wed: ['build-push', 'build-abs'],
  Thu: ['build-pull', 'build-legs'], Fri: ['build-push', 'build-abs'], Sat: ['build-pull', 'build-legs'], Sun: []
} as Record<MovementWeekday, BuildSnackSlot[]>)[day];

const buildLabel = (slotId: BuildSnackSlot): string =>
  slotId === 'build-push' ? 'Push' : slotId === 'build-abs' ? 'Abs' : slotId === 'build-pull' ? 'Pull' : 'Legs';

export const defaultMovementSnackRegimen = (movePool: ExerciseDefinition[] = cloneQuickLogDefaults(), buildPool: ExerciseDefinition[] = defaultMovementSnackBuildPool()): MovementSnackRegimen => {
  const output = {} as MovementSnackRegimen;
  MOVEMENT_WEEKDAYS.forEach((day) => {
    const tasks: MovementSnackTask[] = buildSlotsForDay(day).map((slotId) => {
      const defaultExercise = BUILD_EXERCISES[slotId];
      const exercise = buildPool.find((entry) => entry.id === defaultExercise.id) ?? defaultExercise;
      return { slotId, kind: 'build', label: buildLabel(slotId), exercise: { ...exercise }, setCount: 3 };
    });
    const moveCount = day === 'Sun' ? 4 : 2;
    for (let i = 0; i < moveCount; i++) {
      const exercise = movePool[i % movePool.length] ?? { id: 'march', name: 'Marching in place', amount: 1, unit: 'minutes' as const };
      tasks.splice(i * 2, 0, { slotId: `move-${i + 1}` as MoveSnackSlot, kind: 'move', label: `Move ${i + 1}`, exercise: { ...exercise }, setCount: 1 });
    }
    output[day] = tasks;
  });
  return output;
};

export const movementSnackPlanForDate = (date: Date, movePool: ExerciseDefinition[], regimen: MovementSnackRegimen = defaultMovementSnackRegimen(movePool)): MovementSnackTask[] => {
  const day = DAY_NAMES[date.getDay()];
  return regimen[day].map((task) => ({ ...task, exercise: { ...task.exercise } }));
};

export const movementSnackPlanForTimestamp = (timestamp: number = Date.now(), rolloverHour = DEFAULT_DAY_ROLLOVER_HOUR, movePool: ExerciseDefinition[] = [], regimen?: MovementSnackRegimen): MovementSnackTask[] =>
  movementSnackPlanForDate(new Date(getStatsDayWindow(timestamp, rolloverHour).startTs), movePool, regimen);

export interface MovementSnackPrefs {
  dailyGoal: number;
  hardExercises: ExerciseDefinition[];
  easyExercises: ExerciseDefinition[];
  /** Individual exercises in the Daily movement burst + panel (increment per tap). */
  quickLogExercises: ExerciseDefinition[];
  regimen: MovementSnackRegimen;
  mobilityPool: ExerciseDefinition[];
  buildPool: ExerciseDefinition[];
  movePool: ExerciseDefinition[];
}

export const defaultMovementSnackHardExercises = (): ExerciseDefinition[] => [
  { id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' },
  { id: 'squats', name: 'Air squats', amount: 20, unit: 'reps' },
  { id: 'reverse-crunches', name: 'Reverse crunches', amount: 11, unit: 'reps' },
];

export const defaultMovementSnackEasyExercises = (): ExerciseDefinition[] => [
  { id: 'pushups', name: 'Push-ups', amount: 10, unit: 'reps' },
  { id: 'plank', name: 'Plank', amount: 25, unit: 'seconds' },
];

export const defaultMovementSnackPrefs = (): MovementSnackPrefs => ({
  dailyGoal: 4,
  hardExercises: defaultMovementSnackHardExercises(),
  easyExercises: defaultMovementSnackEasyExercises(),
  quickLogExercises: cloneQuickLogDefaults(),
  regimen: defaultMovementSnackRegimen(),
  mobilityPool: defaultMovementSnackMobilityPool(),
  buildPool: defaultMovementSnackBuildPool(),
  movePool: cloneQuickLogDefaults(),
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
    return arr.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const e = entry as Partial<ExerciseDefinition>;
      if (typeof e.id !== 'string' || typeof e.name !== 'string' || REMOVED_EXERCISE_IDS.has(e.id) || !Number.isFinite(e.amount)) return [];
      if (e.unit !== 'reps' && e.unit !== 'seconds' && e.unit !== 'minutes') return [];
      const amount = e.amount as number;
      const repRange = normalizeRepRange(e.repRange, e.unit);
      const currentProgression = typeof e.currentProgression === 'string' ? e.currentProgression.trim() : '';
      return [{
        id: e.id,
        name: e.name,
        amount: Math.max(0, Math.round(amount)),
        unit: e.unit,
        ...(repRange ? { repRange } : {}),
        ...(currentProgression ? { currentProgression } : {})
      }];
    });
  };

  const normalizeBuildExercise = (exercise: ExerciseDefinition): ExerciseDefinition | null => {
    if (exercise.unit !== 'reps') return null;
    return {
      ...exercise,
      repRange: exercise.repRange ?? { min: exercise.amount, max: exercise.amount },
      currentProgression: exercise.currentProgression ?? ''
    };
  };

  const hardExercises = parseExercises(raw.hardExercises);
  const easyExercises = parseExercises(raw.easyExercises);
  const quickParsed = raw.quickLogExercises === undefined ? null : parseExercises(raw.quickLogExercises);
  const moveParsed = raw.movePool === undefined ? quickParsed : parseExercises(raw.movePool);
  const movePool = moveParsed === null || moveParsed.length === 0 ? base.movePool : moveParsed;
  const buildParsed = raw.buildPool === undefined ? null : parseExercises(raw.buildPool);
  const normalizedBuildPool = buildParsed?.flatMap((exercise) => {
    const normalized = normalizeBuildExercise(exercise);
    return normalized ? [normalized] : [];
  });
  const buildPool = normalizedBuildPool === null || normalizedBuildPool === undefined || normalizedBuildPool.length === 0 ? base.buildPool : normalizedBuildPool;
  const mobilityParsed = raw.mobilityPool === undefined ? null : parseExercises(raw.mobilityPool);
  const mobilityPool = mobilityParsed === null || mobilityParsed.length === 0 ? base.mobilityPool : mobilityParsed;
  const quickLogExercises = movePool;
  const rawRegimen = raw.regimen as Partial<MovementSnackRegimen> | undefined;
  const defaultRegimen = defaultMovementSnackRegimen(movePool, buildPool);
  const regimen = {} as MovementSnackRegimen;
  MOVEMENT_WEEKDAYS.forEach((day) => {
    const fallback = defaultRegimen[day];
    const candidate = Array.isArray(rawRegimen?.[day]) ? rawRegimen[day] : [];
    regimen[day] = fallback.map((task, index) => {
      const saved = candidate[index] as Partial<MovementSnackTask> | undefined;
      const pool = task.kind === 'build' ? buildPool : movePool;
      const savedExercise = saved?.exercise && typeof saved.exercise === 'object' ? parseExercises([saved.exercise])[0] : undefined;
      const exercise = savedExercise ? pool.find((entry) => entry.id === savedExercise.id) : undefined;
      return exercise ? { ...task, exercise: { ...exercise } } : task;
    });
  });

  return {
    dailyGoal: parseGoal(),
    hardExercises: hardExercises.length > 0 ? hardExercises : base.hardExercises,
    easyExercises: easyExercises.length > 0 ? easyExercises : base.easyExercises,
    quickLogExercises,
    regimen,
    mobilityPool,
    buildPool,
    movePool,
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

export const buildMovementSnackSetLogEntry = (
  task: MovementSnackTask,
  day: string,
  exercise: ExerciseDefinition,
  setNumber: number,
  id: string,
  completedAt: number = Date.now()
): WorkoutLogEntry => {
  const entry = buildMovementSnackLogEntry([exercise], id, completedAt);
  return {
    ...entry,
    workoutId: `movement-${task.kind}-${task.slotId}`,
    workoutName: `${task.kind === 'build' ? 'Build' : 'Move'} · ${task.label}`,
    movementSnack: { day, slotId: task.slotId, kind: task.kind, setNumber, setCount: task.setCount }
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
      (log.workoutId === MOVEMENT_SNACK_HARD_WORKOUT_ID || log.workoutId === MOVEMENT_SNACK_EASY_WORKOUT_ID || log.workoutId.startsWith('movement-')) &&
      log.completedAt >= startTs &&
      log.completedAt < endTs
  );
};

export const countMovementSnacksToday = (
  logs: WorkoutLogEntry[],
  nowTimestamp = Date.now(),
  rolloverHour = DEFAULT_DAY_ROLLOVER_HOUR
): number => {
  const today = movementSnackDayKey(nowTimestamp, rolloverHour);
  const keys = new Set<string>();
  let legacyCount = 0;
  movementSnackLogsToday(logs, nowTimestamp, rolloverHour).forEach((log) => {
    if (log.movementSnack?.day === today) keys.add(log.movementSnack.slotId);
    else legacyCount += 1;
  });
  return keys.size + legacyCount;
};

export const hardMovementSnackLogsToday = (
  logs: WorkoutLogEntry[],
  nowTimestamp = Date.now(),
  rolloverHour = DEFAULT_DAY_ROLLOVER_HOUR
): WorkoutLogEntry[] => movementSnackLogsToday(logs, nowTimestamp, rolloverHour).filter(isHardMovementSnackLog);
