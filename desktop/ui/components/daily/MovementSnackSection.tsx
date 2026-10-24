import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useSession } from '@/context/SessionContext';
import { hasAppStorage } from '@/lib/appRuntime';
import {
  buildSnackProgress,
  buildTasksFromPlan,
  findMovementSnackSetLog,
  movementSnackDayKey,
  movementSnackLogsToday,
  movementSnackPlanForTimestamp,
  movementSnackSidesForExercise,
  type MovementSnackSide,
  type MovementSnackTask
} from '@/lib/movementSnack/movementSnack';
import { TrackerSummary } from '@/components/daily/TrackerChain';
import './movement.css';

type Props = { onTrackerLinkedTaskChange?: () => void };

function BuildRepInput({
  amount,
  ariaLabel,
  onCommit
}: {
  amount: number | undefined;
  ariaLabel: string;
  onCommit: (value: string) => void;
}) {
  const logged = amount != null ? String(amount) : '';
  const [draft, setDraft] = useState(logged);
  useEffect(() => { setDraft(logged); }, [logged]);
  const commit = () => {
    if (draft.trim() === logged) return;
    onCommit(draft);
  };
  return (
    <input
      className="build-notes-rep"
      type="text"
      inputMode="numeric"
      placeholder="x"
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
      onBlur={commit}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') { event.currentTarget.blur(); }
      }}
    />
  );
}

function BuildSetRow({
  task,
  side,
  label,
  findLog,
  onSave
}: {
  task: MovementSnackTask;
  side?: MovementSnackSide;
  label?: string;
  findLog: (setNumber: number, side?: MovementSnackSide) => ReturnType<typeof findMovementSnackSetLog>;
  onSave: (setNumber: number, value: string, side?: MovementSnackSide) => void;
}) {
  const sets = Array.from({ length: task.setCount }, (_, index) => {
    const setNumber = index + 1;
    const log = findLog(setNumber, side);
    const amount = log?.exercises[0] && 'unit' in log.exercises[0] ? log.exercises[0].amount : undefined;
    return (
      <span key={setNumber} className="build-notes-set-cell">
        {index > 0 ? <span className="build-notes-sep" aria-hidden="true"> / </span> : null}
        <BuildRepInput
          amount={amount}
          ariaLabel={`${task.exercise.name}${label ? ` ${label}` : ''} set ${setNumber}`}
          onCommit={(value) => onSave(setNumber, value, side)}
        />
      </span>
    );
  });
  if (!label) return <span className="build-notes-sets">{sets}</span>;
  return (
    <div className="build-notes-side-row">
      <span className="build-notes-side-label">{label}:</span>
      <span className="build-notes-sets">{sets}</span>
    </div>
  );
}

export default function MovementSnackSection({ onTrackerLinkedTaskChange }: Props) {
  const { movementSnackPrefs, workoutLogs, dayRolloverHour, logMovementSnackSet, removeWorkoutLog, sessionStorageReady } = useSession();
  const tasks = useMemo(
    () => buildTasksFromPlan(movementSnackPlanForTimestamp(Date.now(), dayRolloverHour, movementSnackPrefs.movePool, movementSnackPrefs.regimen)),
    [dayRolloverHour, movementSnackPrefs.movePool, movementSnackPrefs.regimen]
  );
  const day = movementSnackDayKey(Date.now(), dayRolloverHour);
  const logs = useMemo(() => movementSnackLogsToday(workoutLogs, Date.now(), dayRolloverHour), [workoutLogs, dayRolloverHour]);
  const progress = useMemo(() => buildSnackProgress(tasks, logs, day), [tasks, logs, day]);

  if (!hasAppStorage()) return null;
  if (!sessionStorageReady) return <p className="movement-tracker-empty">Loading movement…</p>;

  const findLog = (task: MovementSnackTask, setNumber: number, side?: MovementSnackSide) =>
    findMovementSnackSetLog(logs, day, task.slotId, setNumber, side);

  const saveBuildSet = (task: MovementSnackTask, setNumber: number, value: string, side?: MovementSnackSide) => {
    const existing = findLog(task, setNumber, side);
    if (!value.trim()) {
      if (existing) { removeWorkoutLog(existing.id); onTrackerLinkedTaskChange?.(); }
      return;
    }
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    if (existing) removeWorkoutLog(existing.id);
    logMovementSnackSet(task, day, { ...task.exercise, amount: Math.round(amount) }, setNumber, side);
    onTrackerLinkedTaskChange?.();
  };

  return (
    <section className="movement-tracker-container" aria-label="Build snacks">
      <TrackerSummary
        prefix="movement"
        today={progress.completedTasks}
        target={<>{progress.totalTasks || 0} Build snack{progress.totalTasks === 1 ? '' : 's'} today</>}
        remainingText={
          progress.totalTasks === 0
            ? 'No Build snacks today'
            : progress.completedTasks >= progress.totalTasks
              ? 'Workout complete'
              : `${progress.totalTasks - progress.completedTasks} Build snack${progress.totalTasks - progress.completedTasks === 1 ? '' : 's'} left`
        }
        remainingClass={progress.totalTasks > 0 && progress.completedTasks >= progress.totalTasks ? ' movement-remaining-done' : ''}
        progressRatio={progress.totalTasks > 0 ? progress.completedTasks / progress.totalTasks : 0}
        showProgress={progress.totalTasks > 0}
      />
      {tasks.length === 0 ? (
        <p className="build-notes-empty">No Build snacks today</p>
      ) : (
        <div className="build-notes-list">
          {tasks.map((task, index) => {
            const progression = task.exercise.currentProgression?.trim();
            const unilateral = Boolean(task.exercise.unilateral);
            return (
              <div className="build-notes-entry" key={task.slotId}>
                <div className="build-notes-line">
                  <span className="build-notes-title">BUILD {index + 1}</span>
                  <span className="build-notes-dash" aria-hidden="true">—</span>
                  <span className="build-notes-name">{task.exercise.name}</span>
                  {!unilateral ? (
                    <>
                      <span className="build-notes-dash" aria-hidden="true">—</span>
                      <BuildSetRow task={task} findLog={(setNumber, side) => findLog(task, setNumber, side)} onSave={(setNumber, value, side) => saveBuildSet(task, setNumber, value, side)} />
                    </>
                  ) : null}
                  {progression ? (
                    <>
                      <span className="build-notes-dash" aria-hidden="true">—</span>
                      <span className="build-notes-progression">{progression}</span>
                    </>
                  ) : null}
                </div>
                {unilateral
                  ? movementSnackSidesForExercise(task.exercise).map((side) => (
                      <BuildSetRow
                        key={side}
                        task={task}
                        side={side}
                        label={side === 'right' ? 'Right' : 'Left'}
                        findLog={(setNumber, rowSide) => findLog(task, setNumber, rowSide)}
                        onSave={(setNumber, value, rowSide) => saveBuildSet(task, setNumber, value, rowSide)}
                      />
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
