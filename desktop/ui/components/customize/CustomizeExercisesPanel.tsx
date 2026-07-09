import { useCallback, useMemo, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useSession } from '@/context/SessionContext';
import {
  applyExerciseOverride,
  FILLS_ENTIRE_BREAK_CONFIRM_MESSAGE,
  maxStretchHoldSeconds,
  timedExerciseNeedsFillBreakConfirm,
  resolveAllowedStretchPickKeys,
  resolveAllowedWorkoutIdsFromPrefs
} from '@/lib/workoutCustomize';
import {
  PREDEFINED_WORKOUTS,
  formatExerciseAmount,
  type ExerciseDefinition,
  type ExerciseUnit
} from '@/lib/workoutPlanner';
import { createPrefixedId } from '@/lib/exerciseForm';
import {
  CustomizePanel,
  ExerciseEditRow,
  NewExerciseForm,
  exerciseDraft
} from '@/components/customize/CustomizePrimitives';

type PendingConfirm =
  | { kind: 'override'; exerciseId: string; amount: number; unit: ExerciseUnit }
  | { kind: 'newCustom'; exercise: ExerciseDefinition };

export default function CustomizeExercisesPanel() {
  const {
    workoutCustomizePrefs,
    handleAllowedWorkoutToggle,
    updateExerciseOverride,
    addCustomExercise,
    removeCustomExercise
  } = useSession();
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState(10);
  const [customUnit, setCustomUnit] = useState<ExerciseUnit>('reps');

  const allowedWorkoutIds = resolveAllowedWorkoutIdsFromPrefs(workoutCustomizePrefs);
  const allowedStretchKeys = resolveAllowedStretchPickKeys(workoutCustomizePrefs);
  const enabledMoveCount = allowedWorkoutIds.length + allowedStretchKeys.length + workoutCustomizePrefs.customExercises.length;

  const displayExercise = useCallback(
    (ex: ExerciseDefinition): ExerciseDefinition => applyExerciseOverride(ex, workoutCustomizePrefs.exerciseOverrides),
    [workoutCustomizePrefs.exerciseOverrides]
  );

  const tryOverride = useCallback(
    (exercise: ExerciseDefinition, amount: number, unit: ExerciseUnit) => {
      const draft = { ...exercise, amount, unit };
      if (timedExerciseNeedsFillBreakConfirm(draft, maxStretchHoldSeconds(workoutCustomizePrefs))) {
        setPendingConfirm({ kind: 'override', exerciseId: exercise.id, amount, unit });
        return;
      }
      updateExerciseOverride(exercise.id, amount, unit);
    },
    [updateExerciseOverride, workoutCustomizePrefs]
  );

  const predefinedRows = useMemo(
    () => PREDEFINED_WORKOUTS.filter((w) => w.id !== 'stretch-mobility'),
    []
  );

  const handleAddCustom = () => {
    const exercise = exerciseDraft(customName, customAmount, customUnit, createPrefixedId('custom'));
    if (!exercise.name) return;
    if (timedExerciseNeedsFillBreakConfirm(exercise, maxStretchHoldSeconds(workoutCustomizePrefs))) {
      setPendingConfirm({ kind: 'newCustom', exercise });
      return;
    }
    addCustomExercise(exercise);
    setCustomName('');
    setCustomAmount(10);
    setCustomUnit('reps');
  };

  const confirmPending = () => {
    if (!pendingConfirm) return;
    if (pendingConfirm.kind === 'newCustom') {
      addCustomExercise(pendingConfirm.exercise);
      setCustomName('');
      setCustomAmount(10);
      setCustomUnit('reps');
    } else {
      updateExerciseOverride(pendingConfirm.exerciseId, pendingConfirm.amount, pendingConfirm.unit);
    }
    setPendingConfirm(null);
  };

  return (
    <>
      <CustomizePanel
        title="Exercises"
        description="Exercise breaks build a random ~2–3 minute circuit from the moves you turn on below. Stretches live under Customize → Stretches."
      >
        {predefinedRows.map((workout) => {
          const enabled = allowedWorkoutIds.includes(workout.id);
          const isOnlyEnabledMove = enabled && enabledMoveCount === 1;
          return (
            <div key={workout.id} className="plugin-panel-flat space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-semibold leading-snug min-w-0">{workout.name}</p>
                <Switch
                  checked={enabled}
                  disabled={isOnlyEnabledMove}
                  onCheckedChange={(checked) => handleAllowedWorkoutToggle(workout.id, checked)}
                  className="shrink-0"
                />
              </div>
              <ul className="space-y-0">
                {workout.exercises.map((ex) => {
                  const shown = displayExercise(ex);
                  return (
                    <ExerciseEditRow
                      key={ex.id}
                      name={ex.name}
                      amount={shown.amount}
                      unit={shown.unit}
                      preview={formatExerciseAmount(shown)}
                      onAmount={(n) => tryOverride(ex, n, shown.unit)}
                      onUnit={(u) => tryOverride(ex, shown.amount, u)}
                    />
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="plugin-panel-flat space-y-3">
          <p className="font-semibold">Your exercises</p>
          <NewExerciseForm
            name={customName}
            amount={customAmount}
            unit={customUnit}
            onName={setCustomName}
            onAmount={setCustomAmount}
            onUnit={setCustomUnit}
            onSubmit={handleAddCustom}
            namePlaceholder="e.g. Band pull-aparts"
          />
          {workoutCustomizePrefs.customExercises.length === 0 ? (
            <p className="plugin-empty text-xs">No custom exercises yet.</p>
          ) : (
            <ul className="space-y-0">
              {workoutCustomizePrefs.customExercises.map((ex) => {
                const shown = displayExercise(ex);
                return (
                  <ExerciseEditRow
                    key={ex.id}
                    name={ex.name}
                    amount={shown.amount}
                    unit={shown.unit}
                    preview={formatExerciseAmount(shown)}
                    onAmount={(n) => tryOverride(ex, n, shown.unit)}
                    onUnit={(u) => tryOverride(ex, shown.amount, u)}
                    onRemove={() => removeCustomExercise(ex.id)}
                    removeDisabled={enabledMoveCount === 1}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </CustomizePanel>

      <Dialog open={pendingConfirm !== null} onOpenChange={(open) => { if (!open) setPendingConfirm(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Long exercise</DialogTitle>
            <DialogDescription>{FILLS_ENTIRE_BREAK_CONFIRM_MESSAGE}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className="plugin-btn" onClick={() => setPendingConfirm(null)}>Cancel</button>
            <button type="button" className="plugin-btn plugin-btn-primary" onClick={confirmPending}>OK</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
