import { describe, expect, it } from 'vitest';
import { defaultWorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import {
  applyCantExerciseModePrefs,
  isDiscreetBreakWorkout,
  pickBreakWorkoutFromPrefs,
  POMODORO_EXERCISE_BREAK_INTERVAL,
  refineBreakWorkoutForCantExerciseMode,
  shouldScheduleExerciseOnPomodoroBreak
} from '@/lib/exerciseBreak';
import { pickWorkoutForBreak } from '@/lib/workoutPlanner';

describe('shouldScheduleExerciseOnPomodoroBreak', () => {
  it('schedules exercise every two pomodoros by default', () => {
    expect(POMODORO_EXERCISE_BREAK_INTERVAL).toBe(2);
    expect(shouldScheduleExerciseOnPomodoroBreak(1)).toBe(false);
    expect(shouldScheduleExerciseOnPomodoroBreak(2)).toBe(true);
    expect(shouldScheduleExerciseOnPomodoroBreak(3)).toBe(false);
    expect(shouldScheduleExerciseOnPomodoroBreak(4)).toBe(true);
  });
});

describe('applyCantExerciseModePrefs', () => {
  it('keeps marching and stretches only', () => {
    const prefs = defaultWorkoutCustomizePrefs();
    const discreet = applyCantExerciseModePrefs(prefs);
    expect(discreet.allowedWorkoutIds).toEqual(['march-spot']);
    expect(discreet.customExercises).toEqual([]);
    expect(discreet.allowedStretchPickKeys.length).toBeGreaterThan(0);
  });

  it('falls back to march plus stretches when user disabled all discreet moves', () => {
    const prefs = {
      ...defaultWorkoutCustomizePrefs(),
      allowedWorkoutIds: ['push-ups'],
      allowedStretchPickKeys: []
    };
    const discreet = applyCantExerciseModePrefs(prefs);
    expect(discreet.allowedWorkoutIds).toEqual(['march-spot']);
    expect(discreet.allowedStretchPickKeys.length).toBeGreaterThan(0);
  });

  it('never picks push-ups or shadowboxing in discreet mode', () => {
    const workout = pickWorkoutForBreak(applyCantExerciseModePrefs(defaultWorkoutCustomizePrefs()), 0.55);
    expect(workout.exercises.every((e) => e.id === 'march' || e.id.startsWith('stretch-'))).toBe(true);
  });
});

describe('pickBreakWorkoutFromPrefs', () => {
  it('uses full pool when cant-exercise mode is off', () => {
    const workout = pickBreakWorkoutFromPrefs(defaultWorkoutCustomizePrefs(), false, 0.37);
    expect(isDiscreetBreakWorkout(workout)).toBe(false);
  });

  it('limits to marching and stretches when cant-exercise mode is on', () => {
    const workout = pickBreakWorkoutFromPrefs(defaultWorkoutCustomizePrefs(), true, 0.55);
    expect(isDiscreetBreakWorkout(workout)).toBe(true);
  });
});

describe('refineBreakWorkoutForCantExerciseMode', () => {
  it('re-picks when a stored break has push-ups but cant-exercise mode is on', () => {
    const heavy = pickBreakWorkoutFromPrefs(defaultWorkoutCustomizePrefs(), false, 0.37);
    expect(isDiscreetBreakWorkout(heavy)).toBe(false);
    const refined = refineBreakWorkoutForCantExerciseMode(heavy, true, defaultWorkoutCustomizePrefs(), 0.55);
    expect(refined).not.toBeNull();
    expect(isDiscreetBreakWorkout(refined)).toBe(true);
  });

  it('leaves discreet workouts unchanged', () => {
    const discreet = pickBreakWorkoutFromPrefs(defaultWorkoutCustomizePrefs(), true, 0.55);
    expect(refineBreakWorkoutForCantExerciseMode(discreet, true, defaultWorkoutCustomizePrefs(), 0.99)).toBe(discreet);
  });
});
