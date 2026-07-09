import { DEFAULT_DAY_ROLLOVER_HOUR, getStatsDayWindow } from '@/lib/dayBoundary';
import type { ExerciseRunAgg } from '@mgmt/core';
import { formatTimedDuration } from '@/lib/workoutCustomize';
import {
  focusEntryCountsAsSession,
  type ExerciseDefinition,
  type FocusLogEntry,
  type FocusTimeSeriesPoint,
  type PeriodStatsPoint,
  type StoredExercise,
  type TimeSeriesPoint,
  type WorkoutLogEntry,
  type WorkoutTotals
} from './workoutTypes';

const logTimedSeconds = (log: WorkoutLogEntry): number => {
  if (typeof log.totalTimedSeconds === 'number') return log.totalTimedSeconds;
  return sumExerciseVolume(log.exercises).timedSeconds;
};

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
