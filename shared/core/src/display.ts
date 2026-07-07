import type { StoredExercise } from './sessionTypes';

export const formatClock = (totalSeconds: number): string => {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const formatExerciseAmount = (exercise: StoredExercise): string => {
  if ('unit' in exercise) {
    if (exercise.unit === 'reps') return `${exercise.amount} reps`;
    if (exercise.unit === 'seconds') return `${exercise.amount}s hold`;
    return `${exercise.amount} min`;
  }
  return `${exercise.reps} reps`;
};
