export type SessionType = 'pomodoro' | 'deep';

export type ExerciseUnit = 'reps' | 'seconds' | 'minutes';

export interface ExerciseDefinition {
  id: string;
  name: string;
  amount: number;
  unit: ExerciseUnit;
}

export type LegacyExercise = { id: string; name: string; reps: number };

export type StoredExercise = ExerciseDefinition | LegacyExercise;

export interface WorkoutDefinition {
  id: string;
  name: string;
  estimatedMinutes: number;
  exercises: ExerciseDefinition[];
}

export interface ExerciseRunAgg {
  id: string;
  label: string;
  reps: number;
  timedSeconds: number;
}
