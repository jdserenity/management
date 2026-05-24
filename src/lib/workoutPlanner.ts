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
      { id: 'shadow', name: 'Light shadowboxing', amount: 90, unit: 'seconds' }
    ]
  }
];

/** Shown on Customize for stretch/mobility (actual break picks 2–3 at 15s each). */
export const STRETCH_MOBILITY_CATALOG_LINES: readonly string[] = [
  'Butterfly Stretch',
  'Neck Roll',
  'Hip Roll',
  'Lateral Shoulder Stretch',
  'Seated Toe Touch Both Legs',
  'Seated Toe Touch One Leg (if this comes up, left and right are both scheduled)',
  'Deep Squat',
  'Standing Quad Stretch'
];

export const DEFAULT_ALLOWED_WORKOUT_IDS = PREDEFINED_WORKOUTS.map((workout) => workout.id);

const DAY_MS = 24 * 60 * 60 * 1000;

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

export const STRETCH_DEFAULT_SECONDS = 15;

type StretchPick = { kind: 'single'; id: string; name: string } | { kind: 'toe-one-leg' };

const STRETCH_POOL: StretchPick[] = [
  { kind: 'single', id: 'stretch-butterfly', name: 'Butterfly Stretch' },
  { kind: 'single', id: 'stretch-neck-roll', name: 'Neck Roll' },
  { kind: 'single', id: 'stretch-hip-roll', name: 'Hip Roll' },
  { kind: 'single', id: 'stretch-lateral-shoulder', name: 'Lateral Shoulder Stretch' },
  { kind: 'single', id: 'stretch-toe-both', name: 'Seated Toe Touch Both Legs' },
  { kind: 'toe-one-leg' },
  { kind: 'single', id: 'stretch-deep-squat', name: 'Deep Squat' },
  { kind: 'single', id: 'stretch-quad-standing', name: 'Standing Quad Stretch' }
];

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

/** 2–3 stretch rows; one-leg toe touch always adds L then R (15s each). */
export const buildStretchBreakExercises = (randomValue: number = Math.random()): ExerciseDefinition[] => {
  const rowTarget = (() => {
    const r = Number.isFinite(randomValue) ? Math.abs(Math.sin(randomValue * 9999)) : Math.random();
    return r < 0.5 ? 2 : 3;
  })();
  const pool = shuffleStretchPool(randomValue);
  const out: ExerciseDefinition[] = [];
  for (const pick of pool) {
    if (out.length >= rowTarget) break;
    if (pick.kind === 'single') {
      out.push({
        id: pick.id,
        name: pick.name,
        amount: STRETCH_DEFAULT_SECONDS,
        unit: 'seconds'
      });
    } else if (out.length + 2 <= rowTarget) {
      out.push(
        { id: 'stretch-toe-one-L', name: 'Seated Toe Touch One Leg (L)', amount: STRETCH_DEFAULT_SECONDS, unit: 'seconds' },
        { id: 'stretch-toe-one-R', name: 'Seated Toe Touch One Leg (R)', amount: STRETCH_DEFAULT_SECONDS, unit: 'seconds' }
      );
    }
  }
  const usedIds = new Set(out.map((e) => e.id));
  while (out.length < rowTarget) {
    const cand = STRETCH_POOL.find((p) => p.kind === 'single' && !usedIds.has(p.id));
    if (!cand || cand.kind !== 'single') break;
    usedIds.add(cand.id);
    out.push({
      id: cand.id,
      name: cand.name,
      amount: STRETCH_DEFAULT_SECONDS,
      unit: 'seconds'
    });
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

const collectStretchMoveCandidates = (): ExerciseDefinition[] => {
  const out: ExerciseDefinition[] = [];
  for (const pick of STRETCH_POOL) {
    if (pick.kind === 'single') {
      out.push({
        id: pick.id,
        name: pick.name,
        amount: STRETCH_DEFAULT_SECONDS,
        unit: 'seconds'
      });
    } else {
      out.push(
        { id: 'stretch-toe-one-L', name: 'Seated Toe Touch One Leg (L)', amount: STRETCH_DEFAULT_SECONDS, unit: 'seconds' },
        { id: 'stretch-toe-one-R', name: 'Seated Toe Touch One Leg (R)', amount: STRETCH_DEFAULT_SECONDS, unit: 'seconds' }
      );
    }
  }
  return out;
};

const collectBreakMoveCandidates = (allowedWorkoutIds: string[]): ExerciseDefinition[] => {
  const allowed = new Set(resolveAllowedWorkoutIds(allowedWorkoutIds));
  const out: ExerciseDefinition[] = [];
  for (const def of PREDEFINED_WORKOUTS) {
    if (!allowed.has(def.id)) continue;
    if (def.id === 'stretch-mobility') {
      out.push(...collectStretchMoveCandidates());
      continue;
    }
    def.exercises.forEach((ex) => out.push({ ...ex }));
  }
  return out;
};

/** Random 2–3 min circuit: samples moves (repeats allowed) from everything you allow in Customize. */
export const buildMixedBreakWorkout = (allowedWorkoutIds: string[], randomValue: number = Math.random()): WorkoutDefinition => {
  let candidates = collectBreakMoveCandidates(allowedWorkoutIds);
  if (candidates.length === 0) {
    candidates = collectBreakMoveCandidates(DEFAULT_ALLOWED_WORKOUT_IDS);
  }
  let seed = Math.floor(Number.isFinite(randomValue) ? Math.abs(randomValue * 1e9) % 1000000007 : Math.random() * 1e9) % 1000000007;
  const rnd = () => {
    seed = (seed * 48271 + 1) % 1000000007;
    return seed / 1000000007;
  };
  const safe01 = Number.isFinite(randomValue) ? Math.abs(Math.sin(randomValue * 8888)) % 1 : Math.random();
  const targetSec = 120 + Math.floor(safe01 * 61);
  const selected: ExerciseDefinition[] = [];
  let sum = 0;
  while (sum < targetSec && selected.length < 30) {
    const ex = candidates[Math.floor(rnd() * candidates.length)];
    selected.push({ ...ex });
    sum += estimateExerciseLoadSeconds(ex);
  }
  while (sum < 110 && candidates.length > 0 && selected.length < 36) {
    const ex = candidates[Math.floor(rnd() * candidates.length)];
    selected.push({ ...ex });
    sum += estimateExerciseLoadSeconds(ex);
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

export const pickWorkoutForBreak = (allowedWorkoutIds: string[], randomValue: number = Math.random()): WorkoutDefinition =>
  buildMixedBreakWorkout(allowedWorkoutIds, randomValue);

const logTimedSeconds = (log: WorkoutLogEntry): number => {
  if (typeof log.totalTimedSeconds === 'number') return log.totalTimedSeconds;
  return sumExerciseVolume(log.exercises).timedSeconds;
};

export const summarizeWorkoutLogs = (logs: WorkoutLogEntry[], nowTimestamp: number = Date.now()): WorkoutTotals => {
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

export interface FocusSessionTotals {
  totalPomodoros: number;
  totalDeepWork: number;
  totalFocusMinutes: number;
  todayPomodoros: number;
  todayDeepWork: number;
  weekly: FocusTimeSeriesPoint[];
  monthly: FocusTimeSeriesPoint[];
}

export const countTodayDeepWorkSessions = (logs: FocusLogEntry[], nowTimestamp: number = Date.now()): number => {
  const start = new Date(nowTimestamp); start.setHours(0, 0, 0, 0);
  const startTimestamp = start.getTime(); const endTimestamp = startTimestamp + DAY_MS;
  return logs.filter((entry) => entry.type === 'deep' && entry.completedAt >= startTimestamp && entry.completedAt < endTimestamp).length;
};

export const countTodayPomodoroSessions = (logs: FocusLogEntry[], nowTimestamp: number = Date.now()): number => {
  const start = new Date(nowTimestamp); start.setHours(0, 0, 0, 0);
  const startTimestamp = start.getTime(); const endTimestamp = startTimestamp + DAY_MS;
  return logs.filter((entry) => entry.type === 'pomodoro' && entry.completedAt >= startTimestamp && entry.completedAt < endTimestamp).length;
};

export const summarizeFocusLogs = (logs: FocusLogEntry[], nowTimestamp: number = Date.now()): FocusSessionTotals => {
  const start = new Date(nowTimestamp); start.setHours(0, 0, 0, 0);
  const todayStart = start.getTime();
  const todayEnd = todayStart + DAY_MS;
  let totalPomodoros = 0;
  let totalDeepWork = 0;
  let totalFocusMinutes = 0;
  let todayPomodoros = 0;
  let todayDeepWork = 0;
  const weeklyMap = new Map<string, FocusTimeSeriesPoint>();
  const monthlyMap = new Map<string, FocusTimeSeriesPoint>();
  const bumpFocusPoint = (map: Map<string, FocusTimeSeriesPoint>, bucket: string, entry: FocusLogEntry) => {
    const point = map.get(bucket) || { bucket, pomodoros: 0, deepWork: 0, focusMinutes: 0 };
    point.focusMinutes += entry.durationMinutes;
    if (entry.type === 'pomodoro') point.pomodoros += 1;
    else point.deepWork += 1;
    map.set(bucket, point);
  };
  logs.forEach((entry) => {
    totalFocusMinutes += entry.durationMinutes;
    bumpFocusPoint(weeklyMap, toWeekBucket(entry.completedAt), entry);
    bumpFocusPoint(monthlyMap, toMonthBucket(new Date(entry.completedAt)), entry);
    if (entry.type === 'pomodoro') {
      totalPomodoros += 1;
      if (entry.completedAt >= todayStart && entry.completedAt < todayEnd) todayPomodoros += 1;
    } else {
      totalDeepWork += 1;
      if (entry.completedAt >= todayStart && entry.completedAt < todayEnd) todayDeepWork += 1;
    }
  });
  const weekly = [...weeklyMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-8);
  const monthly = [...monthlyMap.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)).slice(-6);
  return {
    totalPomodoros,
    totalDeepWork,
    totalFocusMinutes,
    todayPomodoros,
    todayDeepWork,
    weekly,
    monthly
  };
};

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
  if ('unit' in exercise && exercise.unit === 'seconds') return `${exercise.amount}s`;
  if ('unit' in exercise && exercise.unit === 'minutes') return `${exercise.amount} min`;
  if ('reps' in exercise && typeof exercise.reps === 'number') return `${exercise.reps} reps`;
  return '';
};

export interface ExerciseRunAgg {
  id: string;
  label: string;
  reps: number;
  timedSeconds: number;
}

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
  if (agg.reps > 0) {
    if (agg.id === 'pushups') parts.push(`${agg.reps} pushups`);
    else parts.push(`${agg.reps} reps`);
  }
  if (agg.timedSeconds > 0) {
    if (agg.timedSeconds % 60 === 0 && agg.timedSeconds >= 60) parts.push(`${agg.timedSeconds / 60} min`);
    else parts.push(`${agg.timedSeconds}s`);
  }
  if (parts.length === 0) return agg.label;
  return `${agg.label} · ${parts.join(' · ')}`;
};
