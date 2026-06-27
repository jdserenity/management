import { isTimestampInStatsDay } from '@/lib/dayBoundary';
import { clampDayRolloverHour } from '@/lib/dayBoundary';
import { scaleExercisesByRatio } from '@/lib/sessionProgress';
import {
  DEFAULT_MORNING_STRETCH_EXERCISE_REFS,
  MORNING_STRETCH_WORKOUT_ID,
  MORNING_STRETCH_WORKOUT_NAME,
  normalizeMorningStretchRoutine,
  repairBuiltinMorningStretchRefs,
  resolveMorningStretchExercises,
  type MorningStretchRef
} from '@/lib/morningStretch/morningStretch';

export { resolveMorningStretchExercises };
import type { WorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import { defaultWorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import { sumExerciseVolume, type ExerciseDefinition, type WorkoutLogEntry } from '@/lib/workoutPlanner';

export const BUILTIN_MORNING_STRETCH_ID = 'morning-stretch';

export type StretchExerciseRef = MorningStretchRef;

export const STRETCH_GRADIENT_IDS = ['sunrise', 'ocean', 'forest', 'lavender', 'ember', 'sky'] as const;
export type StretchGradientId = (typeof STRETCH_GRADIENT_IDS)[number];

export type StretchTrigger =
  | { mode: 'scheduled'; hideAfterHour: number }
  | { mode: 'manual' };

export type StretchDefinition = {
  id: string;
  name: string;
  emoji: string;
  gradientId: StretchGradientId;
  exerciseRefs: StretchExerciseRef[];
  enabled: boolean;
  durationMinutes: number;
  trigger: StretchTrigger;
  builtIn: boolean;
  workoutId: string;
};

export type StretchGradientStyle = {
  label: string;
  cardClass: string;
  ringClass: string;
  buttonClass: string;
  iconClass: string;
  borderClass: string;
};

export const STRETCH_GRADIENT_STYLES: Record<StretchGradientId, StretchGradientStyle> = {
  sunrise: {
    label: 'Sunrise',
    cardClass: 'bg-gradient-to-br from-orange-500/16 via-background to-amber-400/14',
    ringClass: 'ring-orange-500/20',
    buttonClass: 'bg-orange-600 hover:bg-orange-700',
    iconClass: 'text-orange-500',
    borderClass: 'border-orange-500/15'
  },
  ocean: {
    label: 'Ocean',
    cardClass: 'bg-gradient-to-br from-sky-500/16 via-background to-cyan-400/14',
    ringClass: 'ring-sky-500/20',
    buttonClass: 'bg-sky-600 hover:bg-sky-700',
    iconClass: 'text-sky-500',
    borderClass: 'border-sky-500/15'
  },
  forest: {
    label: 'Forest',
    cardClass: 'bg-gradient-to-br from-emerald-500/16 via-background to-lime-400/14',
    ringClass: 'ring-emerald-500/20',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
    iconClass: 'text-emerald-500',
    borderClass: 'border-emerald-500/15'
  },
  lavender: {
    label: 'Lavender',
    cardClass: 'bg-gradient-to-br from-violet-500/16 via-background to-fuchsia-400/14',
    ringClass: 'ring-violet-500/20',
    buttonClass: 'bg-violet-600 hover:bg-violet-700',
    iconClass: 'text-violet-500',
    borderClass: 'border-violet-500/15'
  },
  ember: {
    label: 'Ember',
    cardClass: 'bg-gradient-to-br from-rose-500/16 via-background to-red-400/14',
    ringClass: 'ring-rose-500/20',
    buttonClass: 'bg-rose-600 hover:bg-rose-700',
    iconClass: 'text-rose-500',
    borderClass: 'border-rose-500/15'
  },
  sky: {
    label: 'Sky',
    cardClass: 'bg-gradient-to-br from-blue-500/16 via-background to-indigo-400/14',
    ringClass: 'ring-blue-500/20',
    buttonClass: 'bg-blue-600 hover:bg-blue-700',
    iconClass: 'text-blue-500',
    borderClass: 'border-blue-500/15'
  }
};

export const DEFAULT_STRETCH_DURATION_MINUTES = 5;
export const DEFAULT_SCHEDULED_HIDE_AFTER_HOUR = 11;

const isStretchGradientId = (value: unknown): value is StretchGradientId =>
  typeof value === 'string' && (STRETCH_GRADIENT_IDS as readonly string[]).includes(value);

export const clampStretchDurationMinutes = (minutes: number): number => {
  if (!Number.isFinite(minutes)) return DEFAULT_STRETCH_DURATION_MINUTES;
  const m = Math.trunc(minutes);
  if (m < 1) return 1;
  if (m > 60) return 60;
  return m;
};

const normalizeTrigger = (raw: Partial<StretchTrigger> | null | undefined): StretchTrigger => {
  if (raw?.mode === 'scheduled') {
    return { mode: 'scheduled', hideAfterHour: clampDayRolloverHour(raw.hideAfterHour ?? DEFAULT_SCHEDULED_HIDE_AFTER_HOUR) };
  }
  return { mode: 'manual' };
};

export const defaultBuiltinMorningStretch = (): StretchDefinition => ({
  id: BUILTIN_MORNING_STRETCH_ID,
  name: 'Morning stretch',
  emoji: '🌅',
  gradientId: 'sunrise',
  exerciseRefs: [...DEFAULT_MORNING_STRETCH_EXERCISE_REFS],
  enabled: true,
  durationMinutes: DEFAULT_STRETCH_DURATION_MINUTES,
  trigger: { mode: 'scheduled', hideAfterHour: DEFAULT_SCHEDULED_HIDE_AFTER_HOUR },
  builtIn: true,
  workoutId: MORNING_STRETCH_WORKOUT_ID
});

export const createStretchId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `stretch-${crypto.randomUUID()}`;
  return `stretch-${Date.now()}`;
};

export const defaultUserStretch = (partial?: Partial<StretchDefinition>): StretchDefinition =>
  normalizeStretchDefinition(
    {
      id: createStretchId(),
      name: 'New stretch',
      emoji: '🧘',
      gradientId: 'ocean',
      exerciseRefs: [],
      enabled: true,
      durationMinutes: DEFAULT_STRETCH_DURATION_MINUTES,
      trigger: { mode: 'manual' },
      builtIn: false,
      ...partial
    },
    defaultWorkoutCustomizePrefs(),
    defaultBuiltinMorningStretch()
  );

export const normalizeStretchDefinition = (
  raw: Partial<StretchDefinition> | null | undefined,
  prefs: WorkoutCustomizePrefs,
  fallback?: StretchDefinition
): StretchDefinition => {
  const base = fallback ?? defaultBuiltinMorningStretch();
  if (!raw) return { ...base };
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : base.id;
  const builtIn = raw.builtIn === true || id === BUILTIN_MORNING_STRETCH_ID;
  const routine = normalizeMorningStretchRoutine({ exerciseRefs: raw.exerciseRefs }, prefs);
  const exerciseRefs = builtIn ? repairBuiltinMorningStretchRefs(routine.exerciseRefs) : routine.exerciseRefs;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : (builtIn ? base.name : 'New stretch');
  const emoji = typeof raw.emoji === 'string' && raw.emoji.trim() ? raw.emoji.trim() : (builtIn ? base.emoji : '🧘');
  const workoutId = typeof raw.workoutId === 'string' && raw.workoutId.trim() ? raw.workoutId.trim() : (builtIn ? MORNING_STRETCH_WORKOUT_ID : id);
  const defaultTrigger: StretchTrigger = builtIn ? base.trigger : { mode: 'manual' };
  return {
    id,
    name,
    emoji,
    gradientId: isStretchGradientId(raw.gradientId) ? raw.gradientId : (builtIn ? base.gradientId : 'ocean'),
    exerciseRefs,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    durationMinutes: typeof raw.durationMinutes === 'number' ? clampStretchDurationMinutes(raw.durationMinutes) : DEFAULT_STRETCH_DURATION_MINUTES,
    trigger: raw.trigger ? normalizeTrigger(raw.trigger) : defaultTrigger,
    builtIn,
    workoutId
  };
};

export const listScheduledStretches = (stretches: StretchDefinition[]): StretchDefinition[] =>
  stretches.filter((s) => s.enabled && s.trigger.mode === 'scheduled');

export const stretchHideCutoffMs = (nowTimestamp: number, hideAfterHour: number): number => {
  const d = new Date(nowTimestamp);
  d.setHours(hideAfterHour, 0, 0, 0);
  return d.getTime();
};

export const isBeforeStretchHideCutoff = (nowTimestamp: number, hideAfterHour: number): boolean =>
  nowTimestamp < stretchHideCutoffMs(nowTimestamp, hideAfterHour);

export type StretchVisibilityInput = {
  stretch: StretchDefinition;
  completedToday: boolean;
  nowTimestamp?: number;
  activeRun?: boolean;
};

export const shouldShowStretchSection = ({
  stretch,
  completedToday,
  nowTimestamp = Date.now(),
  activeRun = false
}: StretchVisibilityInput): boolean => {
  if (activeRun) return true;
  if (!stretch.enabled) return false;
  if (stretch.trigger.mode !== 'scheduled') return false;
  if (completedToday) return false;
  return isBeforeStretchHideCutoff(nowTimestamp, stretch.trigger.hideAfterHour);
};

export const isStretchCompletedToday = (
  stretch: Pick<StretchDefinition, 'workoutId'>,
  logs: WorkoutLogEntry[],
  nowTimestamp: number = Date.now(),
  rolloverHour: number
): boolean =>
  logs.some(
    (log) =>
      log.workoutId === stretch.workoutId &&
      isTimestampInStatsDay(log.completedAt, nowTimestamp, rolloverHour)
  );

export const stretchCompletionRatio = (elapsedSeconds: number, durationMinutes: number): number => {
  const total = Math.max(1, durationMinutes * 60);
  return Math.min(1, Math.max(0, elapsedSeconds / total));
};

export const buildStretchLogEntry = (
  stretch: Pick<StretchDefinition, 'workoutId' | 'name' | 'emoji'>,
  exercises: ExerciseDefinition[],
  id: string,
  completedAt: number = Date.now(),
  completionRatio: number = 1
): WorkoutLogEntry => {
  const ratio = Math.min(1, Math.max(0, completionRatio));
  const scaled = scaleExercisesByRatio(exercises, ratio);
  const vol = sumExerciseVolume(scaled);
  const displayName = stretch.emoji ? `${stretch.emoji} ${stretch.name}` : stretch.name;
  return {
    id,
    workoutId: stretch.workoutId,
    workoutName: stretch.workoutId === MORNING_STRETCH_WORKOUT_ID ? MORNING_STRETCH_WORKOUT_NAME : displayName,
    completedAt,
    exercises: scaled,
    totalReps: vol.reps,
    totalTimedSeconds: vol.timedSeconds,
    completionRatio: ratio
  };
};
