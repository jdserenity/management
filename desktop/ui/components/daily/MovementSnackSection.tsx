import { useMemo, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { hasAppStorage } from '@/lib/appRuntime';
import { movementSnackDayKey, movementSnackLogsToday, movementSnackPlanForTimestamp, type MovementSnackTask } from '@/lib/movementSnack/movementSnack';
import { completeTasksLinkedToMovementBurst } from '@/lib/streak/crossLinks';
import { TrackerSummary } from '@/components/daily/TrackerChain';
import { formatExerciseAmount, formatExerciseRunAggLine, formatExerciseTarget, listTodayMovementTotals, type ExerciseDefinition } from '@/lib/workoutPlanner';
import './movement.css';

type Props = { onLinkedTaskComplete?: () => void };

export default function MovementSnackSection({ onLinkedTaskComplete }: Props) {
  const { movementSnackPrefs, workoutLogs, dayRolloverHour, todayExerciseTotals, todayStretchTotals, logMovementSnackSet, removeWorkoutLog, sessionStorageReady } = useSession();
  const [overrides, setOverrides] = useState<Record<string, ExerciseDefinition>>({});
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const tasks = useMemo(() => movementSnackPlanForTimestamp(Date.now(), dayRolloverHour, movementSnackPrefs.movePool, movementSnackPrefs.regimen), [dayRolloverHour, movementSnackPrefs.movePool, movementSnackPrefs.regimen]);
  const day = movementSnackDayKey(Date.now(), dayRolloverHour);
  const logs = useMemo(() => movementSnackLogsToday(workoutLogs, Date.now(), dayRolloverHour), [workoutLogs, dayRolloverHour]);
  const completedSets = (task: MovementSnackTask) => logs.filter((log) => log.movementSnack?.day === day && log.movementSnack.slotId === task.slotId);
  const done = tasks.reduce((count, task) => count + (completedSets(task).length >= task.setCount ? 1 : 0), 0);
  const movementTotals = useMemo(() => listTodayMovementTotals(todayExerciseTotals, todayStretchTotals), [todayExerciseTotals, todayStretchTotals]);

  if (!hasAppStorage()) return null;
  if (!sessionStorageReady) return <p className="movement-tracker-empty">Loading movement…</p>;

  const afterMovementLogged = () => {
    void completeTasksLinkedToMovementBurst().catch((error) => console.error('Failed to complete linked movement task:', error));
    onLinkedTaskComplete?.();
  };
  const logMove = (task: MovementSnackTask, exercise: ExerciseDefinition) => {
    logMovementSnackSet(task, day, exercise, 1);
    afterMovementLogged();
  };
  const undoMove = (task: MovementSnackTask) => {
    const log = completedSets(task)[0];
    if (log) removeWorkoutLog(log.id);
  };
  const saveBuildSet = (task: MovementSnackTask, setNumber: number, value: string) => {
    const amount = Number(value);
    if (!value.trim() || !Number.isFinite(amount) || amount < 0) return;
    const existing = completedSets(task).find((log) => log.movementSnack?.setNumber === setNumber);
    if (existing) removeWorkoutLog(existing.id);
    const exercise = { ...task.exercise, amount: Math.round(amount) };
    logMovementSnackSet(task, day, exercise, setNumber);
    afterMovementLogged();
  };

  return <section className="movement-tracker-container" aria-label="Movement snacks">
    <TrackerSummary prefix="movement" today={done} target={<>{tasks.length} movement snacks today</>} remainingText={done >= tasks.length ? 'Workout complete' : `${tasks.length - done} movement snack${tasks.length - done === 1 ? '' : 's'} left`} remainingClass={done >= tasks.length ? ' movement-remaining-done' : ''} progressRatio={tasks.length > 0 ? done / tasks.length : 0} showProgress />
    <div className="movement-regimen-list">
      {tasks.map((task) => {
        const taskLogs = completedSets(task);
        const loggedExercise = taskLogs[0]?.exercises[0];
        const exercise = overrides[task.slotId] ?? (loggedExercise && 'unit' in loggedExercise ? loggedExercise : task.exercise);
        return <div className="movement-snack-task" key={task.slotId}>
          <div className="movement-snack-task-heading">
            <div><strong>{task.kind === 'move' ? 'Move' : 'Build'} · {task.label}</strong><div className="movement-snack-task-exercise">Target: {formatExerciseTarget(task.exercise)}{task.kind === 'build' ? ' each set' : ''}{task.kind === 'build' && task.exercise.currentProgression ? ` · ${task.exercise.currentProgression}` : ''}</div></div>
            {task.kind === 'move' && movementSnackPrefs.movePool.length > 0 ? <select className="movement-custom-input" aria-label={`Override ${task.label}`} value={exercise.id} onChange={(event) => { const next = movementSnackPrefs.movePool.find((entry) => entry.id === event.target.value); if (next) setOverrides((current) => ({ ...current, [task.slotId]: next })); }}>
              {movementSnackPrefs.movePool.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {formatExerciseAmount(entry)}</option>)}
            </select> : null}
          </div>
          {task.kind === 'move' ? <button type="button" className={`movement-chain-btn${taskLogs.length > 0 ? ' movement-chain-done' : ''}`} onClick={() => taskLogs.length > 0 ? undoMove(task) : logMove(task, exercise)}>{taskLogs.length > 0 ? `✓ ${formatExerciseAmount(taskLogs[0].exercises[0])}` : formatExerciseAmount(exercise)}</button> : <div className="movement-build-sets">
            {Array.from({ length: task.setCount }, (_, index) => {
              const setNumber = index + 1;
              const log = taskLogs.find((entry) => entry.movementSnack?.setNumber === setNumber);
              const key = `${task.slotId}-${setNumber}`;
              const value = actuals[key] ?? (log?.exercises[0] && 'unit' in log.exercises[0] ? String(log.exercises[0].amount) : '');
              return <div className="movement-build-set" key={setNumber}><span className="movement-build-set-label">Set {setNumber} · goal {formatExerciseTarget(task.exercise)}</span><input className="movement-custom-input" type="number" min={0} inputMode="numeric" value={value} onChange={(event) => setActuals((current) => ({ ...current, [key]: event.target.value }))} aria-label={`${task.label} set ${setNumber} actual amount`} /><button type="button" className={`movement-chain-btn${log ? ' movement-chain-done' : ''}`} onClick={() => saveBuildSet(task, setNumber, value)}>{log ? 'Update' : 'Save set'}</button></div>;
            })}
          </div>}
        </div>;
      })}
    </div>
    {movementTotals.length > 0 ? <div className="movement-totals"><div className="movement-region"><p className="movement-region-title">Today&apos;s movement</p>{movementTotals.map((agg) => <div key={agg.id} className="movement-region-row">{formatExerciseRunAggLine(agg)}</div>)}</div></div> : null}
  </section>;
}
