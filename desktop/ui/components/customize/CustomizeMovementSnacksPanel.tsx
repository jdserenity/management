import { useCallback } from 'react';
import { useSession } from '@/context/SessionContext';
import { MOVEMENT_WEEKDAYS, updateBuildExerciseSettings, type MovementSnackRegimen, type MovementWeekday } from '@/lib/movementSnack/movementSnack';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';

export default function CustomizeMovementSnacksPanel() {
  const { movementSnackPrefs, updateMovementSnackPrefs } = useSession();
  const updateRegimen = useCallback((next: MovementSnackRegimen) => updateMovementSnackPrefs({ regimen: next }), [updateMovementSnackPrefs]);
  const updateBuildSlot = useCallback((day: MovementWeekday, index: number, exerciseId: string) => {
    const sourcePool = movementSnackPrefs.buildPool;
    const exercise = sourcePool.find((entry) => entry.id === exerciseId);
    if (!exercise) return;
    const next = { ...movementSnackPrefs.regimen, [day]: movementSnackPrefs.regimen[day].map((task, i) => i === index ? { ...task, exercise: { ...exercise } } : task) };
    updateRegimen(next);
  }, [movementSnackPrefs.buildPool, movementSnackPrefs.regimen, updateRegimen]);
  const updateBuildTarget = useCallback((exerciseId: string, min: number, max: number) => {
    updateMovementSnackPrefs(updateBuildExerciseSettings(movementSnackPrefs, exerciseId, { repRange: { min, max } }));
  }, [movementSnackPrefs, updateMovementSnackPrefs]);
  const updateBuildProgression = useCallback((exerciseId: string, currentProgression: string) => {
    updateMovementSnackPrefs(updateBuildExerciseSettings(movementSnackPrefs, exerciseId, { currentProgression }));
  }, [movementSnackPrefs, updateMovementSnackPrefs]);
  return <CustomizePanel title="Movement regimen" description="Build ranges and progressions apply everywhere the same Build exercise appears in the week. Move blocks are randomly selected from the Move pool each day.">
    <div className="movement-regimen-customize-list">
      {MOVEMENT_WEEKDAYS.map((day) => <div className="movement-regimen-customize-day" key={day}>
        <h3 className="font-semibold">{day}</h3>
        {movementSnackPrefs.regimen[day].map((task, index) => {
          return <div className="movement-regimen-customize-row" key={task.slotId}>
            <span className="movement-regimen-customize-label">{task.kind === 'move' ? 'Move' : 'Build'} · {task.label}{task.kind === 'build' ? ' · 3 sets' : ''}</span>
            {task.kind === 'move' ? <span className="plugin-muted text-sm">Random from Move pool</span> : <>
              <select className="plugin-select" value={task.exercise.id} onChange={(event) => updateBuildSlot(day, index, event.target.value)} aria-label={`${day} ${task.label} exercise`}>
                {movementSnackPrefs.buildPool.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
              {task.exercise.repRange ? <div className="movement-build-target-fields">
              <label>Target <input className="plugin-input w-16 font-semibold tabular-nums" type="number" min={0} value={task.exercise.repRange.min} onChange={(event) => { const min = Math.max(0, Math.round(Number(event.target.value))); updateBuildTarget(task.exercise.id, min, Math.max(task.exercise.repRange!.max, min + 1)); }} aria-label={`${task.exercise.name} minimum reps`} /></label>
              <span>–</span>
              <label><input className="plugin-input w-16 font-semibold tabular-nums" type="number" min={task.exercise.repRange.min + 1} value={task.exercise.repRange.max} onChange={(event) => updateBuildTarget(task.exercise.id, task.exercise.repRange!.min, Math.max(task.exercise.repRange!.min + 1, Math.round(Number(event.target.value))))} aria-label={`${task.exercise.name} maximum reps`} /> reps</label>
              <label>Progression <input className="plugin-input w-36" value={task.exercise.currentProgression ?? ''} onChange={(event) => updateBuildProgression(task.exercise.id, event.target.value)} placeholder="e.g. incline" aria-label={`${task.exercise.name} current progression`} /></label>
              </div> : null}
            </>}
          </div>;
        })}
      </div>)}
    </div>
  </CustomizePanel>;
}
