import { useCallback } from 'react';
import { useSession } from '@/context/SessionContext';
import { MOVEMENT_WEEKDAYS, updateBuildExerciseSettings, type MovementSnackRegimen, type MovementWeekday } from '@/lib/movementSnack/movementSnack';
import type { ExerciseUnit } from '@/lib/workoutPlanner';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';

const taskPoolKey = (kind: 'build' | 'move'): 'buildPool' | 'movePool' => kind === 'build' ? 'buildPool' : 'movePool';

export default function CustomizeMovementSnacksPanel() {
  const { movementSnackPrefs, updateMovementSnackPrefs } = useSession();
  const updateRegimen = useCallback((next: MovementSnackRegimen) => updateMovementSnackPrefs({ regimen: next }), [updateMovementSnackPrefs]);
  const updateSlot = useCallback((day: MovementWeekday, index: number, exerciseId: string) => {
    const sourcePool = movementSnackPrefs[taskPoolKey(movementSnackPrefs.regimen[day][index].kind)];
    const exercise = sourcePool.find((entry) => entry.id === exerciseId);
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
  const updateBuildTarget = useCallback((exerciseId: string, min: number, max: number) => {
    updateMovementSnackPrefs(updateBuildExerciseSettings(movementSnackPrefs, exerciseId, { repRange: { min, max } }));
  }, [movementSnackPrefs, updateMovementSnackPrefs]);
  const updateBuildProgression = useCallback((exerciseId: string, currentProgression: string) => {
    updateMovementSnackPrefs(updateBuildExerciseSettings(movementSnackPrefs, exerciseId, { currentProgression }));
  }, [movementSnackPrefs, updateMovementSnackPrefs]);
  return <CustomizePanel title="Movement regimen" description="Configure every scheduled target here. Build ranges and progressions apply everywhere the same Build exercise appears in the week.">
    <div className="movement-regimen-customize-list">
      {MOVEMENT_WEEKDAYS.map((day) => <div className="movement-regimen-customize-day" key={day}>
        <h3 className="font-semibold">{day}</h3>
        {movementSnackPrefs.regimen[day].map((task, index) => {
          const sourcePool = movementSnackPrefs[taskPoolKey(task.kind)];
          const options = [task.exercise, ...sourcePool.filter((entry) => entry.id !== task.exercise.id)];
          return <div className="movement-regimen-customize-row" key={task.slotId}>
            <span className="movement-regimen-customize-label">{task.kind === 'move' ? 'Move' : 'Build'} · {task.label}{task.kind === 'build' ? ' · 3 sets' : ''}</span>
            <select className="plugin-select" value={task.exercise.id} onChange={(event) => updateSlot(day, index, event.target.value)} aria-label={`${day} ${task.label} exercise`}>
              {options.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
            {task.kind === 'build' && task.exercise.repRange ? <div className="movement-build-target-fields">
              <label>Target <input className="plugin-input w-16 font-semibold tabular-nums" type="number" min={0} value={task.exercise.repRange.min} onChange={(event) => { const min = Math.max(0, Math.round(Number(event.target.value))); updateBuildTarget(task.exercise.id, min, Math.max(task.exercise.repRange!.max, min + 1)); }} aria-label={`${task.exercise.name} minimum reps`} /></label>
              <span>–</span>
              <label><input className="plugin-input w-16 font-semibold tabular-nums" type="number" min={task.exercise.repRange.min + 1} value={task.exercise.repRange.max} onChange={(event) => updateBuildTarget(task.exercise.id, task.exercise.repRange!.min, Math.max(task.exercise.repRange!.min + 1, Math.round(Number(event.target.value))))} aria-label={`${task.exercise.name} maximum reps`} /> reps</label>
              <label>Progression <input className="plugin-input w-36" value={task.exercise.currentProgression ?? ''} onChange={(event) => updateBuildProgression(task.exercise.id, event.target.value)} placeholder="e.g. incline" aria-label={`${task.exercise.name} current progression`} /></label>
            </div> : <>
              <input className="plugin-input w-16 font-semibold tabular-nums" type="number" min={0} value={task.exercise.amount} onChange={(event) => updateAmount(day, index, Number(event.target.value))} aria-label={`${day} ${task.label} target amount`} />
              <select className="plugin-select text-xs" value={task.exercise.unit} onChange={(event) => updateUnit(day, index, event.target.value as ExerciseUnit)} aria-label={`${day} ${task.label} unit`}>
                <option value="reps">reps</option><option value="seconds">sec</option><option value="minutes">min</option>
              </select>
            </>}
          </div>;
        })}
      </div>)}
    </div>
  </CustomizePanel>;
}
