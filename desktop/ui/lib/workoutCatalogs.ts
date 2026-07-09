import type { ExerciseDefinition, WorkoutDefinition } from './workoutTypes';

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
      { id: 'shadow', name: 'Light shadowboxing', amount: 60, unit: 'seconds' }
    ]
  },
  {
    id: 'arm-rolls',
    name: '🔄 Arm Rolls',
    estimatedMinutes: 1,
    exercises: [
      { id: 'arm-rolls', name: 'Arm rolls', amount: 30, unit: 'seconds' }
    ]
  },
  {
    id: 'reverse-lunges',
    name: '🦵 Reverse Lunges',
    estimatedMinutes: 1,
    exercises: [
      { id: 'reverse-lunges', name: 'Reverse lunges', amount: 10, unit: 'reps' }
    ]
  },
  {
    id: 'reverse-crunches',
    name: '🤸 Reverse Crunches',
    estimatedMinutes: 1,
    exercises: [
      { id: 'reverse-crunches', name: 'Reverse crunches', amount: 15, unit: 'reps' }
    ]
  },
  {
    id: 'plank',
    name: '🧘 Plank',
    estimatedMinutes: 1,
    exercises: [
      { id: 'plank', name: 'Plank', amount: 30, unit: 'seconds' }
    ]
  }
];

export type StretchPick =
  | { kind: 'single'; id: string; name: string }
  | { kind: 'bilateral'; left: { id: string; name: string }; right: { id: string; name: string } };

export const STRETCH_PICK_CATALOG: readonly { key: string; label: string; pick: StretchPick }[] = [
  { key: 'stretch-butterfly', label: 'Butterfly Stretch', pick: { kind: 'single', id: 'stretch-butterfly', name: 'Butterfly Stretch' } },
  { key: 'stretch-neck-roll', label: 'Neck Roll', pick: { kind: 'single', id: 'stretch-neck-roll', name: 'Neck Roll' } },
  { key: 'stretch-hip-roll', label: 'Hip Roll', pick: { kind: 'single', id: 'stretch-hip-roll', name: 'Hip Roll' } },
  { key: 'stretch-foot', label: 'Foot Stretch', pick: { kind: 'single', id: 'stretch-foot', name: 'Foot Stretch' } },
  {
    key: 'stretch-lateral-shoulder',
    label: 'Lateral Shoulder Stretch (left and right)',
    pick: {
      kind: 'bilateral',
      left: { id: 'stretch-lateral-shoulder-L', name: 'Lateral Shoulder Stretch (L)' },
      right: { id: 'stretch-lateral-shoulder-R', name: 'Lateral Shoulder Stretch (R)' }
    }
  },
  { key: 'stretch-toe-both', label: 'Seated Toe Touch Both Legs', pick: { kind: 'single', id: 'stretch-toe-both', name: 'Seated Toe Touch Both Legs' } },
  {
    key: 'stretch-toe-one',
    label: 'Seated Toe Touch One Leg (left and right)',
    pick: {
      kind: 'bilateral',
      left: { id: 'stretch-toe-one-L', name: 'Seated Toe Touch One Leg (L)' },
      right: { id: 'stretch-toe-one-R', name: 'Seated Toe Touch One Leg (R)' }
    }
  },
  { key: 'stretch-deep-squat', label: 'Deep Squat', pick: { kind: 'single', id: 'stretch-deep-squat', name: 'Deep Squat' } },
  { key: 'stretch-forward-hang', label: 'Standing Forward Hang', pick: { kind: 'single', id: 'stretch-forward-hang', name: 'Standing Forward Hang' } },
  {
    key: 'stretch-quad-standing',
    label: 'Standing Quad Stretch (left and right)',
    pick: {
      kind: 'bilateral',
      left: { id: 'stretch-quad-standing-L', name: 'Standing Quad Stretch (L)' },
      right: { id: 'stretch-quad-standing-R', name: 'Standing Quad Stretch (R)' }
    }
  }
];

/** @deprecated use STRETCH_PICK_CATALOG labels */
export const STRETCH_MOBILITY_CATALOG_LINES: readonly string[] = STRETCH_PICK_CATALOG.map((row) => row.label);

export const DEFAULT_ALLOWED_WORKOUT_IDS = PREDEFINED_WORKOUTS.map((workout) => workout.id);

