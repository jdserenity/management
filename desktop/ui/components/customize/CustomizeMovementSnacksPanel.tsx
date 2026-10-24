import { useCallback } from 'react';
import { useSession } from '@/context/SessionContext';
import {
  BUILD_TEMPLATE_DAYS,
  buildTasksForTemplateDay,
  updateBuildExerciseSettings,
  updateBuildSlotOnTemplateDay,
  type BuildTemplateDay
} from '@/lib/movementSnack/movementSnack';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';

export default function CustomizeMovementSnacksPanel() {
  const { movementSnackPrefs, updateMovementSnackPrefs } = useSession();
  const updateBuildSlot = useCallback((day: BuildTemplateDay, slotId: string, exerciseId: string) => {
    const exercise = movementSnackPrefs.buildPool.find((entry) => entry.id === exerciseId);
    if (!exercise) return;
    updateMovementSnackPrefs({ regimen: updateBuildSlotOnTemplateDay(movementSnackPrefs.regimen, day, slotId, exercise) });
  }, [movementSnackPrefs.buildPool, movementSnackPrefs.regimen, updateMovementSnackPrefs]);
  const updateBuildTarget = useCallback((exerciseId: string, min: number, max: number) => {
    updateMovementSnackPrefs(updateBuildExerciseSettings(movementSnackPrefs, exerciseId, { repRange: { min, max } }));
  }, [movementSnackPrefs, updateMovementSnackPrefs]);
  const updateBuildProgression = useCallback((exerciseId: string, currentProgression: string) => {
    updateMovementSnackPrefs(updateBuildExerciseSettings(movementSnackPrefs, exerciseId, { currentProgression }));
  }, [movementSnackPrefs, updateMovementSnackPrefs]);
  return (
    <CustomizePanel
      title="Build regimen"
      description="Day 1 and Day 2 alternate through the week (Mon/Wed/Fri vs Tue/Thu/Sat). Ranges and progressions apply everywhere the same Build exercise appears."
    >
      <div className="movement-regimen-customize-list">
        {BUILD_TEMPLATE_DAYS.map((day) => (
          <div className="movement-regimen-customize-day" key={day}>
            <h3 className="font-semibold">Day {day}</h3>
            {buildTasksForTemplateDay(movementSnackPrefs.regimen, day).map((task, index) => (
              <div className="movement-regimen-customize-row" key={task.slotId}>
                <span className="movement-regimen-customize-label">BUILD {index + 1} · {task.label} · 3 sets</span>
                <select
                  className="plugin-select"
                  value={task.exercise.id}
                  onChange={(event) => updateBuildSlot(day, task.slotId, event.target.value)}
                  aria-label={`Day ${day} BUILD ${index + 1} exercise`}
                >
                  {movementSnackPrefs.buildPool.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
                {task.exercise.repRange ? (
                  <div className="movement-build-target-fields">
                    <label>
                      Target{' '}
                      <input
                        className="plugin-input w-16 font-semibold tabular-nums"
                        type="number"
                        min={0}
                        value={task.exercise.repRange.min}
                        onChange={(event) => {
                          const min = Math.max(0, Math.round(Number(event.target.value)));
                          updateBuildTarget(task.exercise.id, min, Math.max(task.exercise.repRange!.max, min + 1));
                        }}
                        aria-label={`${task.exercise.name} minimum reps`}
                      />
                    </label>
                    <span>–</span>
                    <label>
                      <input
                        className="plugin-input w-16 font-semibold tabular-nums"
                        type="number"
                        min={task.exercise.repRange.min + 1}
                        value={task.exercise.repRange.max}
                        onChange={(event) =>
                          updateBuildTarget(
                            task.exercise.id,
                            task.exercise.repRange!.min,
                            Math.max(task.exercise.repRange!.min + 1, Math.round(Number(event.target.value)))
                          )
                        }
                        aria-label={`${task.exercise.name} maximum reps`}
                      />{' '}
                      reps
                    </label>
                    <label>
                      Progression{' '}
                      <input
                        className="plugin-input w-36"
                        value={task.exercise.currentProgression ?? ''}
                        onChange={(event) => updateBuildProgression(task.exercise.id, event.target.value)}
                        placeholder="e.g. incline"
                        aria-label={`${task.exercise.name} current progression`}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </CustomizePanel>
  );
}
