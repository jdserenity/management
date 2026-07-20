import type { ExerciseDefinition } from '@/lib/workoutTypes';

/** Default Individual exercise increments on Daily → movement burst logger (+ panel). */
export const DEFAULT_MOVEMENT_QUICK_LOG_EXERCISES: ExerciseDefinition[] = [
  { id: 'pushups', name: 'Push-ups', amount: 5, unit: 'reps' },
  { id: 'jacks', name: 'Jumping jacks', amount: 10, unit: 'reps' },
  { id: 'squats', name: 'Air squats', amount: 5, unit: 'reps' },
  { id: 'march', name: 'Marching in place', amount: 1, unit: 'minutes' },
  { id: 'shadow', name: 'Light shadowboxing', amount: 30, unit: 'seconds' }
];

export const cloneQuickLogDefaults = (): ExerciseDefinition[] =>
  DEFAULT_MOVEMENT_QUICK_LOG_EXERCISES.map((row) => ({ ...row }));
