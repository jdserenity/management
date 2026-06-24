import { describe, expect, it } from 'vitest';
import { defaultWorkoutCustomizePrefs } from '@/lib/workoutCustomize';
import {
  applyCantExerciseModePrefs,
  POMODORO_EXERCISE_BREAK_INTERVAL,
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
