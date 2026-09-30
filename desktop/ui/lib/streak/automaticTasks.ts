import type { AutomaticStreakTaskKind } from '@/lib/streak/types';

export const AUTOMATIC_STREAK_TASKS: ReadonlyArray<{ kind: AutomaticStreakTaskKind; id: string; name: string; description: string }> = [
  { kind: 'water', id: 'automatic-water', name: 'Water goal', description: 'Completed when you reach your daily water target.' },
  { kind: 'food', id: 'automatic-food', name: 'Food goals', description: 'Completed when you reach every configured daily nutrition target.' },
  { kind: 'workout', id: 'automatic-workout', name: 'Workout goal', description: 'Completed when you finish every movement task for today.' }
];

export type AutomaticTaskProgress = Partial<{
  water: { totalMl: number; targetMl: number };
  food: { calories: number; calorieTarget: number; protein: number; proteinTarget: number };
  workout: { completedTasks: number; totalTasks: number };
}>;

export const automaticTaskChecks = (progress: AutomaticTaskProgress): Partial<Record<AutomaticStreakTaskKind, boolean>> => {
  const checks: Partial<Record<AutomaticStreakTaskKind, boolean>> = {};
  if (progress.water) checks.water = progress.water.targetMl > 0 && progress.water.totalMl >= progress.water.targetMl;
  if (progress.food) {
    const { calories, calorieTarget, protein, proteinTarget } = progress.food;
    checks.food = (calorieTarget > 0 || proteinTarget > 0) &&
      (calorieTarget <= 0 || calories >= calorieTarget) &&
      (proteinTarget <= 0 || protein >= proteinTarget);
  }
  if (progress.workout) checks.workout = progress.workout.totalTasks > 0 && progress.workout.completedTasks >= progress.workout.totalTasks;
  return checks;
};

export const automaticTaskDefinition = (kind: AutomaticStreakTaskKind) =>
  AUTOMATIC_STREAK_TASKS.find((task) => task.kind === kind)!;
