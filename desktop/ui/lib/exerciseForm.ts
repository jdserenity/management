import type { ExerciseUnit } from '@/lib/workoutPlanner';

export type { ExerciseUnit };

export const EXERCISE_UNIT_OPTIONS: { value: ExerciseUnit; label: string }[] = [
  { value: 'reps', label: 'reps' },
  { value: 'seconds', label: 'sec' },
  { value: 'minutes', label: 'min' }
];

export const createPrefixedId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}`;
};
