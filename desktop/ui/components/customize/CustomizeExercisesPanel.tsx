import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { TimerReset, Plus, Trash2 } from 'lucide-react';
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
import { EXERCISE_UNIT_OPTIONS as UNIT_OPTIONS, createPrefixedId } from '@/lib/exerciseForm';

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

  const commitOverride = useCallback(
    (exerciseId: string, amount: number, unit: ExerciseUnit) => {
      updateExerciseOverride(exerciseId, amount, unit);
    },
    [updateExerciseOverride]
  );

  const tryOverride = useCallback(
    (exercise: ExerciseDefinition, amount: number, unit: ExerciseUnit) => {
      const draft = { ...exercise, amount, unit };
      if (timedExerciseNeedsFillBreakConfirm(draft, maxStretchHoldSeconds(workoutCustomizePrefs))) {
        setPendingConfirm({ kind: 'override', exerciseId: exercise.id, amount, unit });
        return;
      }
      commitOverride(exercise.id, amount, unit);
    },
    [commitOverride, workoutCustomizePrefs]
  );

  const predefinedRows = useMemo(
    () => PREDEFINED_WORKOUTS.filter((w) => w.id !== 'stretch-mobility'),
    []
  );

  const handleAddCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const exercise: ExerciseDefinition = {
      id: createPrefixedId('custom'),
      name,
      amount: Math.max(0, Math.round(customAmount)),
      unit: customUnit
    };
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
      commitOverride(pendingConfirm.exerciseId, pendingConfirm.amount, pendingConfirm.unit);
    }
    setPendingConfirm(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TimerReset className="h-5 w-5 text-violet-600" />
            Exercises
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Exercise breaks build a random ~2–3 minute circuit from the moves you turn on below. Stretches are configured under Customize → Stretches. The same move can show up again on a later break in the day, but never twice in one break.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {predefinedRows.map((workout) => {
            const enabled = allowedWorkoutIds.includes(workout.id);
            const isOnlyEnabledMove = enabled && enabledMoveCount === 1;
            return (
              <div key={workout.id} className="space-y-2 rounded-md border px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-lg font-semibold leading-snug min-w-0">{workout.name}</p>
                  <Switch
                    checked={enabled}
                    disabled={isOnlyEnabledMove}
                    onCheckedChange={(checked) => handleAllowedWorkoutToggle(workout.id, checked)}
                    className="shrink-0"
                  />
                </div>
                <ul className="space-y-2">
                  {workout.exercises.map((ex) => {
                    const shown = displayExercise(ex);
                    return (
                      <li key={ex.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-2">
                        <span className="text-sm font-medium">{ex.name}</span>
                        <label className="flex items-center gap-1.5 text-sm shrink-0">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold tabular-nums"
                            value={shown.amount}
                            onChange={(e) => tryOverride(ex, Number(e.target.value), shown.unit)}
                          />
                          <select
                            className="rounded-md border border-input bg-background px-1 py-1 text-xs"
                            value={shown.unit}
                            onChange={(e) => tryOverride(ex, shown.amount, e.target.value as ExerciseUnit)}
                          >
                            {UNIT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <span className="text-xs text-muted-foreground tabular-nums">({formatExerciseAmount(shown)})</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <div className="space-y-3 rounded-md border px-3 py-3">
            <p className="text-lg font-semibold">Your exercises</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Name</span>
                <input
                  className="min-w-[10rem] rounded-md border border-input bg-background px-2 py-1 text-sm"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Band pull-aparts"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Amount</span>
                <input
                  type="number"
                  min={0}
                  className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold tabular-nums"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Unit</span>
                <select
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as ExerciseUnit)}
                >
                  {UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={handleAddCustom}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            {workoutCustomizePrefs.customExercises.length === 0 ? (
              <p className="text-xs text-muted-foreground">No custom exercises yet.</p>
            ) : (
              <ul className="space-y-2">
                {workoutCustomizePrefs.customExercises.map((ex) => {
                  const shown = displayExercise(ex);
                  const isOnlyEnabledMove = enabledMoveCount === 1;
                  return (
                    <li key={ex.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-2">
                      <span className="text-sm font-medium">{ex.name}</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            type="number"
                            min={0}
                            className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold tabular-nums"
                            value={shown.amount}
                            onChange={(e) => tryOverride(ex, Number(e.target.value), shown.unit)}
                          />
                          <select
                            className="rounded-md border border-input bg-background px-1 py-1 text-xs"
                            value={shown.unit}
                            onChange={(e) => tryOverride(ex, shown.amount, e.target.value as ExerciseUnit)}
                          >
                            {UNIT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <span className="text-xs text-muted-foreground">({formatExerciseAmount(shown)})</span>
                        </label>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={isOnlyEnabledMove}
                          aria-label={`Remove ${ex.name}`}
                          onClick={() => removeCustomExercise(ex.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={pendingConfirm !== null} onOpenChange={(open) => { if (!open) setPendingConfirm(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Long exercise</DialogTitle>
            <DialogDescription>{FILLS_ENTIRE_BREAK_CONFIRM_MESSAGE}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingConfirm(null)}>Cancel</Button>
            <Button type="button" onClick={confirmPending}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
