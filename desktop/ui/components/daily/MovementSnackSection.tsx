import { useMemo, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { hasAppStorage } from '@/lib/appRuntime';
import { movementSnackDayKey, movementSnackLogsToday, movementSnackPlanForTimestamp, type MovementSnackTask } from '@/lib/movementSnack/movementSnack';
import { formatNearestHalfHourLabel } from '@/lib/movementSnack/nearestHalfHour';
import { completeTasksLinkedToMovementBurst } from '@/lib/streak/crossLinks';
import { TrackerSummary } from '@/components/daily/TrackerChain';
import { formatExerciseAmount, formatExerciseRunAggLine, listTodayMovementTotals, type ExerciseDefinition } from '@/lib/workoutPlanner';
import './movement.css';

type Props = { onLinkedTaskComplete?: () => void };

export default function MovementSnackSection({ onLinkedTaskComplete }: Props) {
  const { movementSnackPrefs, workoutLogs, dayRolloverHour, todayExerciseTotals, todayStretchTotals, logMovementSnackSet, removeWorkoutLog, sessionStorageReady } = useSession();
  const [overrides, setOverrides] = useState<Record<string, ExerciseDefinition>>({});
  const tasks = useMemo(() => movementSnackPlanForTimestamp(Date.now(), dayRolloverHour, movementSnackPrefs.quickLogExercises), [dayRolloverHour, movementSnackPrefs.quickLogExercises]);
  const day = movementSnackDayKey(Date.now(), dayRolloverHour);
  const logs = useMemo(() => movementSnackLogsToday(workoutLogs, Date.now(), dayRolloverHour), [workoutLogs, dayRolloverHour]);
  const completedSets = (task: MovementSnackTask) => logs.filter((log) => log.movementSnack?.day === day && log.movementSnack.slotId === task.slotId);
  const done = tasks.reduce((count, task) => count + (completedSets(task).length >= task.setCount ? 1 : 0), 0);
  const movementTotals = useMemo(() => listTodayMovementTotals(todayExerciseTotals, todayStretchTotals), [todayExerciseTotals, todayStretchTotals]);

  if (!hasAppStorage()) return null;
  if (!sessionStorageReady) return <p className="movement-tracker-empty">Loading movement…</p>;

  const logSet = (task: MovementSnackTask, setNumber: number) => {
    const exercise = overrides[task.slotId] ?? task.exercise;
    logMovementSnackSet(task, day, exercise, setNumber);
    void completeTasksLinkedToMovementBurst().catch((error) => console.error('Failed to complete linked movement task:', error));
    onLinkedTaskComplete?.();
  };
  const undoSet = (task: MovementSnackTask, setNumber: number) => {
    const log = completedSets(task).find((entry) => entry.movementSnack?.setNumber === setNumber);
    if (log) removeWorkoutLog(log.id);
  };

  return (
    <section className="movement-tracker-container" aria-label="Movement snacks">
      <TrackerSummary prefix="movement" today={done} target={<>{tasks.length} movement snacks today</>} remainingText={done >= tasks.length ? 'Workout complete' : `${tasks.length - done} movement snack${tasks.length - done === 1 ? '' : 's'} left`} remainingClass={done >= tasks.length ? ' movement-remaining-done' : ''} progressRatio={tasks.length > 0 ? done / tasks.length : 0} showProgress />
      <div className="movement-regimen-list">
        {tasks.map((task) => {
          const taskLogs = completedSets(task);
          const loggedExercise = taskLogs[0]?.exercises[0];
          const exercise = overrides[task.slotId] ?? (loggedExercise && 'unit' in loggedExercise ? loggedExercise : task.exercise);
          return (
            <div className="movement-snack-task" key={task.slotId}>
              <div className="movement-snack-task-heading">
                <div><strong>{task.kind === 'build' ? 'Build' : 'Move'} · {task.label}</strong><div className="movement-snack-task-exercise">{exercise.name} · {formatExerciseAmount(exercise)}</div></div>
                {task.kind === 'move' && movementSnackPrefs.quickLogExercises.length > 0 ? <select className="movement-custom-input" aria-label={`Override ${task.label}`} value={exercise.id} onChange={(event) => { const next = movementSnackPrefs.quickLogExercises.find((entry) => entry.id === event.target.value); if (next) setOverrides((current) => ({ ...current, [task.slotId]: next })); }}>
                  {movementSnackPrefs.quickLogExercises.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </select> : null}
              </div>
              <div className="movement-snack-task-sets">
                {Array.from({ length: task.setCount }, (_, index) => {
                  const setNumber = index + 1;
                  const log = taskLogs.find((entry) => entry.movementSnack?.setNumber === setNumber);
                  return <button key={setNumber} type="button" className={`movement-chain-btn${log ? ' movement-chain-done' : ''}`} onClick={() => log ? undoSet(task, setNumber) : logSet(task, setNumber)}>{log ? `Set ${setNumber} · ${formatNearestHalfHourLabel(log.completedAt)}` : `Set ${setNumber}`}</button>;
                })}
              </div>
            </div>
          );
        })}
      </div>
      {movementTotals.length > 0 ? <div className="movement-totals"><div className="movement-region"><p className="movement-region-title">Today&apos;s movement</p>{movementTotals.map((agg) => <div key={agg.id} className="movement-region-row">{formatExerciseRunAggLine(agg)}</div>)}</div></div> : null}
    </section>
  );
}
