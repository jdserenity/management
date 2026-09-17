import { useCallback, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { MOVEMENT_WEEKDAYS, type MovementSnackRegimen, type MovementWeekday } from '@/lib/movementSnack/movementSnack';
import type { ExerciseUnit } from '@/lib/workoutPlanner';
import { createPrefixedId } from '@/lib/exerciseForm';
import { CustomizePanel, NewExerciseForm, exerciseDraft } from '@/components/customize/CustomizePrimitives';

const unitLabel = (unit: ExerciseUnit): string => unit === 'seconds' ? 'sec' : unit === 'minutes' ? 'min' : 'reps';

export default function CustomizeMovementSnacksPanel() {
  const { movementSnackPrefs, updateMovementSnackPrefs } = useSession();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(10);
  const [unit, setUnit] = useState<ExerciseUnit>('reps');

  const updateRegimen = useCallback((next: MovementSnackRegimen) => updateMovementSnackPrefs({ regimen: next }), [updateMovementSnackPrefs]);
  const updateSlot = useCallback((day: MovementWeekday, index: number, exerciseId: string) => {
    const exercise = movementSnackPrefs.quickLogExercises.find((entry) => entry.id === exerciseId);
    if (!exercise) return;
    const next = { ...movementSnackPrefs.regimen, [day]: movementSnackPrefs.regimen[day].map((task, i) => i === index ? { ...task, exercise: { ...exercise } } : task) };
    updateRegimen(next);
  }, [movementSnackPrefs.regimen, movementSnackPrefs.quickLogExercises, updateRegimen]);
  const updateAmount = useCallback((day: MovementWeekday, index: number, value: number) => {
    const next = { ...movementSnackPrefs.regimen, [day]: movementSnackPrefs.regimen[day].map((task, i) => i === index ? { ...task, exercise: { ...task.exercise, amount: Math.max(0, Math.round(value)) } } : task) };
    updateRegimen(next);
  }, [movementSnackPrefs.regimen, updateRegimen]);
  const updateUnit = useCallback((day: MovementWeekday, index: number, value: ExerciseUnit) => {
    const next = { ...movementSnackPrefs.regimen, [day]: movementSnackPrefs.regimen[day].map((task, i) => i === index ? { ...task, exercise: { ...task.exercise, unit: value } } : task) };
    updateRegimen(next);
  }, [movementSnackPrefs.regimen, updateRegimen]);
  const add = () => {
    const exercise = exerciseDraft(name, amount, unit, createPrefixedId('move-pool'));
    if (!exercise.name) return;
    updateMovementSnackPrefs({ quickLogExercises: [...movementSnackPrefs.quickLogExercises, exercise] });
    setName(''); setAmount(10); setUnit('reps'); setAdding(false);
  };

  return <CustomizePanel title="Movement regimen" description="Edit the saved weekly order, exercise, and target amount here. Daily Move overrides come from the pool below; Build tasks stay fixed during the day so their progress remains comparable.">
    <div className="movement-regimen-customize-list">
      {MOVEMENT_WEEKDAYS.map((day) => <div className="movement-regimen-customize-day" key={day}>
        <h3 className="font-semibold">{day}</h3>
        {movementSnackPrefs.regimen[day].map((task, index) => {
          const options = [task.exercise, ...movementSnackPrefs.quickLogExercises.filter((entry) => entry.id !== task.exercise.id)];
          return <div className="movement-regimen-customize-row" key={task.slotId}>
            <span className="movement-regimen-customize-label">{task.kind === 'move' ? 'Move' : 'Build'} · {task.label}{task.kind === 'build' ? ' · 3 sets' : ''}</span>
            <select className="plugin-select" value={task.exercise.id} onChange={(event) => updateSlot(day, index, event.target.value)} aria-label={`${day} ${task.label} exercise`}>
              {options.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
            <input className="plugin-input w-16 font-semibold tabular-nums" type="number" min={0} value={task.exercise.amount} onChange={(event) => updateAmount(day, index, Number(event.target.value))} aria-label={`${day} ${task.label} target amount`} />
            <select className="plugin-select text-xs" value={task.exercise.unit} onChange={(event) => updateUnit(day, index, event.target.value as ExerciseUnit)} aria-label={`${day} ${task.label} unit`}>
              <option value="reps">reps</option><option value="seconds">sec</option><option value="minutes">min</option>
            </select>
            <span className="plugin-muted text-xs">{task.exercise.amount} {unitLabel(task.exercise.unit)}</span>
          </div>;
        })}
      </div>)}
    </div>
    <div className="movement-pool-customize">
      <h3 className="font-semibold">Move snack exercise pool</h3>
      <p className="plugin-muted text-sm">These exercises are available as daily Move overrides.</p>
      <ul className="space-y-0">{movementSnackPrefs.quickLogExercises.map((exercise) => <li className="plugin-row !border-border !py-2 px-0" key={exercise.id}><span className="text-sm font-medium min-w-0 flex-1">{exercise.name}</span><span className="plugin-muted text-sm">{exercise.amount} {unitLabel(exercise.unit)}</span></li>)}</ul>
      <button type="button" className="plugin-btn" onClick={() => setAdding(!adding)}>{adding ? 'Hide form' : '+ Add move exercise'}</button>
      {adding ? <NewExerciseForm name={name} amount={amount} unit={unit} onName={setName} onAmount={setAmount} onUnit={setUnit} onSubmit={add} onCancel={() => setAdding(false)} /> : null}
    </div>
  </CustomizePanel>;
}
