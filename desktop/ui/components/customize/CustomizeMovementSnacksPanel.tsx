import { useCallback, useMemo, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import type { ExerciseDefinition, ExerciseUnit } from '@/lib/workoutPlanner';
import { createPrefixedId } from '@/lib/exerciseForm';
import {
  CustomizePanel,
  ExerciseEditRow,
  NewExerciseForm,
  exerciseDraft
} from '@/components/customize/CustomizePrimitives';

type VersionKind = 'hard' | 'easy';

export default function CustomizeMovementSnacksPanel() {
  const { movementSnackPrefs, updateMovementSnackPrefs } = useSession();
  const [dailyGoal, setDailyGoal] = useState(movementSnackPrefs.dailyGoal);
  const [addingTo, setAddingTo] = useState<VersionKind | null>(null);
  const [addName, setAddName] = useState('');
  const [addAmount, setAddAmount] = useState(10);
  const [addUnit, setAddUnit] = useState<ExerciseUnit>('reps');

  const hardExercises = useMemo(() => movementSnackPrefs.hardExercises, [movementSnackPrefs.hardExercises]);
  const easyExercises = useMemo(() => movementSnackPrefs.easyExercises, [movementSnackPrefs.easyExercises]);

  const commitGoal = useCallback(() => {
    const goal = Math.max(1, Math.round(dailyGoal));
    setDailyGoal(goal);
    updateMovementSnackPrefs({ dailyGoal: goal });
  }, [dailyGoal, updateMovementSnackPrefs]);

  const updateExercise = useCallback(
    (kind: VersionKind, index: number, field: 'amount' | 'unit', value: number | ExerciseUnit) => {
      const list = kind === 'hard' ? [...hardExercises] : [...easyExercises];
      if (index < 0 || index >= list.length) return;
      const ex = { ...list[index] };
      if (field === 'amount') ex.amount = Math.max(0, Math.round(value as number));
      else ex.unit = value as ExerciseUnit;
      list[index] = ex;
      updateMovementSnackPrefs(kind === 'hard' ? { hardExercises: list } : { easyExercises: list });
    },
    [hardExercises, easyExercises, updateMovementSnackPrefs]
  );

  const removeExercise = useCallback(
    (kind: VersionKind, index: number) => {
      const list = kind === 'hard' ? [...hardExercises] : [...easyExercises];
      if (index < 0 || index >= list.length || list.length <= 1) return;
      list.splice(index, 1);
      updateMovementSnackPrefs(kind === 'hard' ? { hardExercises: list } : { easyExercises: list });
    },
    [hardExercises, easyExercises, updateMovementSnackPrefs]
  );

  const addExercise = useCallback(() => {
    if (!addingTo) return;
    const ex = exerciseDraft(addName, addAmount, addUnit, createPrefixedId('snack'));
    if (!ex.name) return;
    const list = addingTo === 'hard' ? [...hardExercises, ex] : [...easyExercises, ex];
    updateMovementSnackPrefs(addingTo === 'hard' ? { hardExercises: list } : { easyExercises: list });
    setAddName('');
    setAddAmount(10);
    setAddUnit('reps');
    setAddingTo(null);
  }, [addName, addAmount, addUnit, addingTo, hardExercises, easyExercises, updateMovementSnackPrefs]);

  const renderList = (kind: VersionKind, exercises: ExerciseDefinition[]) => (
    <ul className="space-y-0">
      {exercises.length === 0 ? (
        <p className="plugin-empty text-xs">No exercises yet.</p>
      ) : (
        exercises.map((ex, index) => (
          <ExerciseEditRow
            key={ex.id}
            name={ex.name}
            amount={ex.amount}
            unit={ex.unit}
            onAmount={(n) => updateExercise(kind, index, 'amount', n)}
            onUnit={(u) => updateExercise(kind, index, 'unit', u)}
            onRemove={() => removeExercise(kind, index)}
            removeDisabled={exercises.length <= 1}
          />
        ))
      )}
    </ul>
  );

  const versionBlock = (kind: VersionKind, title: string, hint: string, exercises: ExerciseDefinition[]) => (
    <div className="plugin-panel-flat space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        <span className="plugin-muted text-xs">{hint}</span>
      </div>
      {renderList(kind, exercises)}
      <div className="space-y-2">
        <button
          type="button"
          className="plugin-btn"
          onClick={() => setAddingTo(addingTo === kind ? null : kind)}
        >
          {addingTo === kind ? 'Hide form' : '+ Add exercise'}
        </button>
        {addingTo === kind ? (
          <NewExerciseForm
            name={addName}
            amount={addAmount}
            unit={addUnit}
            onName={setAddName}
            onAmount={setAddAmount}
            onUnit={setAddUnit}
            onSubmit={addExercise}
            onCancel={() => setAddingTo(null)}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <CustomizePanel
      title="Movement bursts"
      description="Set your daily movement burst goal and customise the hard and easy exercise lists."
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs plugin-muted">
          Daily burst goal
          <input
            type="number"
            min={1}
            className="plugin-input w-20 font-semibold tabular-nums text-foreground"
            value={dailyGoal}
            onChange={(e) => setDailyGoal(Number(e.target.value))}
            onBlur={commitGoal}
          />
        </label>
        <button type="button" className="plugin-btn" onClick={commitGoal}>Update</button>
      </div>
      {versionBlock('hard', '💪 Hard version', 'Ideal burst', hardExercises)}
      {versionBlock('easy', '🌱 Easy version', 'Fallback burst', easyExercises)}
    </CustomizePanel>
  );
}
