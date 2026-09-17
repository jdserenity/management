import { useCallback, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import type { ExerciseUnit } from '@/lib/workoutPlanner';
import { createPrefixedId } from '@/lib/exerciseForm';
import { CustomizePanel, ExerciseEditRow, NewExerciseForm, exerciseDraft } from '@/components/customize/CustomizePrimitives';

export default function CustomizeMovementSnacksPanel() {
  const { movementSnackPrefs, updateMovementSnackPrefs } = useSession();
  const [adding, setAdding] = useState(false); const [name, setName] = useState(''); const [amount, setAmount] = useState(10); const [unit, setUnit] = useState<ExerciseUnit>('reps');
  const update = useCallback((index: number, field: 'amount' | 'unit', value: number | ExerciseUnit) => {
    const next = movementSnackPrefs.quickLogExercises.map((exercise, i) => i === index ? { ...exercise, [field]: field === 'amount' ? Math.max(0, Math.round(value as number)) : value } : exercise);
    updateMovementSnackPrefs({ quickLogExercises: next });
  }, [movementSnackPrefs.quickLogExercises, updateMovementSnackPrefs]);
  const remove = useCallback((index: number) => {
    if (movementSnackPrefs.quickLogExercises.length <= 1) return;
    updateMovementSnackPrefs({ quickLogExercises: movementSnackPrefs.quickLogExercises.filter((_, i) => i !== index) });
  }, [movementSnackPrefs.quickLogExercises, updateMovementSnackPrefs]);
  const add = () => {
    const exercise = exerciseDraft(name, amount, unit, createPrefixedId('move-pool'));
    if (!exercise.name) return;
    updateMovementSnackPrefs({ quickLogExercises: [...movementSnackPrefs.quickLogExercises, exercise] });
    setName(''); setAmount(10); setUnit('reps'); setAdding(false);
  };
  return <CustomizePanel title="Movement snacks" description="Four preset movement tasks are scheduled each day. Build tasks stay fixed; Move tasks can be overridden with an exercise from this pool.">
    <ul className="space-y-0">{movementSnackPrefs.quickLogExercises.map((exercise, index) => <ExerciseEditRow key={exercise.id} name={exercise.name} amount={exercise.amount} unit={exercise.unit} onAmount={(value) => update(index, 'amount', value)} onUnit={(value) => update(index, 'unit', value)} onRemove={() => remove(index)} removeDisabled={movementSnackPrefs.quickLogExercises.length <= 1} />)}</ul>
    <button type="button" className="plugin-btn" onClick={() => setAdding(!adding)}>{adding ? 'Hide form' : '+ Add move exercise'}</button>
    {adding ? <NewExerciseForm name={name} amount={amount} unit={unit} onName={setName} onAmount={setAmount} onUnit={setUnit} onSubmit={add} onCancel={() => setAdding(false)} /> : null}
  </CustomizePanel>;
}
