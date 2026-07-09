// src/components/daily/MovementSnackSection.tsx

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSession } from '@/context/SessionContext';
import { hasAppStorage } from '@/lib/appRuntime';
import { isEasyMovementSnackLog, movementSnackLogsToday } from '@/lib/movementSnack/movementSnack';
import { formatNearestHalfHourLabel } from '@/lib/movementSnack/nearestHalfHour';
import {
  completeTasksLinkedToMovementBurst,
  uncompleteTasksLinkedToMovementBurst
} from '@/lib/streak/crossLinks';
import TdeeChainConnector from '@/components/daily/TdeeChainConnector';
import {
  DASHBOARD_MANUAL_EXERCISES,
  formatExerciseRunAggLine,
  listTodayMovementTotals,
  type ExerciseDefinition,
  type ExerciseUnit
} from '@/lib/workoutPlanner';
import './movement.css';

const manualIncrementLabel = (unit: ExerciseUnit, amount: number) => {
  if (unit === 'reps') return `+${amount}`;
  if (unit === 'seconds') return `+${amount}s`;
  return `+${amount}m`;
};

const cloneExercises = (exercises: ExerciseDefinition[]): ExerciseDefinition[] =>
  exercises.map((ex) => ({ ...ex }));

type Props = {
  onLinkedTaskComplete?: () => void;
};

export default function MovementSnackSection({ onLinkedTaskComplete }: Props) {
  const {
    movementSnackPrefs,
    todayMovementSnacks,
    todayExerciseTotals,
    todayStretchTotals,
    workoutLogs,
    dayRolloverHour,
    logMovementSnackCompletion,
    addManualExercise,
    removeWorkoutLog,
    sessionStorageReady
  } = useSession();

  const [addMode, setAddMode] = useState(false);
  const [hardDraft, setHardDraft] = useState<ExerciseDefinition[]>(() => cloneExercises(movementSnackPrefs.hardExercises));
  const [easyDraft, setEasyDraft] = useState<ExerciseDefinition[]>(() => cloneExercises(movementSnackPrefs.easyExercises));
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState(10);
  const [customUnit, setCustomUnit] = useState<ExerciseUnit>('reps');

  useEffect(() => {
    if (!addMode) return;
    setHardDraft(cloneExercises(movementSnackPrefs.hardExercises));
    setEasyDraft(cloneExercises(movementSnackPrefs.easyExercises));
  }, [addMode, movementSnackPrefs.hardExercises, movementSnackPrefs.easyExercises]);

  const goal = movementSnackPrefs.dailyGoal;
  const done = todayMovementSnacks;
  const ratio = goal > 0 ? Math.min(1, done / goal) : 0;
  const complete = done >= goal;

  const snackLogs = useMemo(
    () => movementSnackLogsToday(workoutLogs, Date.now(), dayRolloverHour),
    [workoutLogs, dayRolloverHour]
  );

  const movementTotals = useMemo(
    () => listTodayMovementTotals(todayExerciseTotals, todayStretchTotals),
    [todayExerciseTotals, todayStretchTotals]
  );

  const updateDraftAmount = useCallback((kind: 'hard' | 'easy', index: number, amount: number) => {
    const rounded = Math.max(0, Math.round(amount));
    if (kind === 'hard') {
      setHardDraft((rows) => rows.map((ex, i) => (i === index ? { ...ex, amount: rounded } : ex)));
    } else {
      setEasyDraft((rows) => rows.map((ex, i) => (i === index ? { ...ex, amount: rounded } : ex)));
    }
  }, []);

  if (!hasAppStorage()) return null;
  if (!sessionStorageReady) return <p className="movement-tracker-empty">Loading movement…</p>;

  const afterBurstLogged = async () => {
    try {
      await completeTasksLinkedToMovementBurst();
    } catch (e) {
      console.error('Failed to complete tasks linked to movement burst', e);
    }
    onLinkedTaskComplete?.();
  };

  const handleLogHard = () => {
    logMovementSnackCompletion(false);
    void afterBurstLogged();
  };

  const handleRemoveSnack = (logId: string) => {
    const remainingAfter = snackLogs.filter((l) => l.id !== logId).length;
    removeWorkoutLog(logId);
    if (remainingAfter === 0) {
      void uncompleteTasksLinkedToMovementBurst()
        .catch((e) => console.error('Failed to uncomplete tasks linked to movement burst', e))
        .finally(() => onLinkedTaskComplete?.());
    }
  };

  const handleCustomAdd = () => {
    const name = customName.trim();
    if (!name) return;
    addManualExercise({
      id: `manual-${Date.now()}`,
      name,
      amount: Math.max(0, Math.round(customAmount)),
      unit: customUnit
    });
    setCustomName('');
    setCustomAmount(10);
    setCustomUnit('reps');
    setAddMode(false);
  };

  const chainItems: ReactNode[] = [];

  if (!addMode) {
    chainItems.push(
      <button
        key="hard"
        type="button"
        className="movement-chain-btn"
        title="Log hard movement burst"
        onClick={handleLogHard}
      >
        <span className="movement-chain-label">Hard burst</span>
      </button>
    );
  }

  snackLogs.forEach((log, i) => {
    const easy = isEasyMovementSnackLog(log);
    const timeLabel = formatNearestHalfHourLabel(log.completedAt);
    const withConnector = chainItems.length > 0 || i > 0;
    chainItems.push(
      withConnector ? <TdeeChainConnector key={`c-snack-${log.id}`} /> : null,
      <button
        key={log.id}
        type="button"
        className={`movement-chain-btn movement-chain-done${easy ? ' movement-chain-done-easy' : ''}`}
        title={`${easy ? 'Easy' : 'Hard'} burst · ${timeLabel} — click to remove`}
        onClick={() => handleRemoveSnack(log.id)}
      >
        <span className="movement-chain-label">{easy ? 'Easy' : 'Hard'} · {timeLabel}</span>
      </button>
    );
  });

  if (chainItems.length > 0) chainItems.push(<TdeeChainConnector key="c-plus" />);
  chainItems.push(
    <button
      key="plus"
      type="button"
      className={`movement-chain-btn movement-chain-plus${addMode ? ' movement-chain-plus-disabled' : ''}`}
      title={addMode ? 'Close add menu first' : 'Log exercise or modified burst'}
      disabled={addMode}
      onClick={() => setAddMode(true)}
    >
      +
    </button>
  );

  const renderSnackEditor = (kind: 'hard' | 'easy', draft: ExerciseDefinition[], primary: boolean) => (
    <div className={`movement-snack-editor${primary ? '' : ' movement-snack-editor-fallback'}`}>
      <p className="movement-snack-editor-title">{kind === 'hard' ? 'Hard burst' : 'Easy burst (fallback)'}</p>
      <ul className="movement-snack-editor-rows">
        {draft.map((ex, index) => (
          <li key={`${kind}-${ex.id}-${index}`} className="movement-snack-editor-row">
            <span className="movement-snack-editor-name">{ex.name}</span>
            <label className="movement-snack-editor-amount">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="movement-custom-input"
                value={ex.amount}
                onChange={(e) => updateDraftAmount(kind, index, Number(e.target.value))}
              />
              <span className="movement-snack-editor-unit">{ex.unit === 'reps' ? 'reps' : ex.unit === 'seconds' ? 'sec' : 'min'}</span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={primary ? 'movement-quick-btn movement-quick-btn-primary' : 'movement-quick-btn'}
        onClick={() => {
          logMovementSnackCompletion(kind === 'easy', draft);
          setAddMode(false);
          void afterBurstLogged();
        }}
      >
        Log {kind} burst
      </button>
    </div>
  );

  return (
    <section className="movement-tracker-container" aria-label="Movement bursts">
      <div className="movement-summary">
        <div className="movement-counts">
          <span>{done}</span>
          <span className="movement-sep"> / </span>
          <span className="movement-target">{goal} movement bursts today</span>
        </div>
        <div className={`movement-remaining${complete ? ' movement-remaining-done' : ''}`}>
          {complete ? 'Goal reached' : `${goal - done} movement burst${goal - done === 1 ? '' : 's'} left`}
        </div>
        {goal > 0 ? (
          <div className="movement-progress">
            <div className="movement-progress-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        ) : null}
      </div>

      <div className="movement-chain">{chainItems}</div>

      {addMode ? (
        <div className="movement-add-panel">
          <div className="movement-add-header">
            <span className="movement-add-title">Log movement</span>
            <button type="button" className="movement-add-close" title="Close" aria-label="Close" onClick={() => setAddMode(false)}>
              ×
            </button>
          </div>
          {renderSnackEditor('hard', hardDraft, true)}
          {renderSnackEditor('easy', easyDraft, false)}
          <div className="movement-snack-quick">
            {DASHBOARD_MANUAL_EXERCISES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="movement-quick-btn"
                onClick={() => { addManualExercise(ex); setAddMode(false); }}
              >
                {ex.name} {manualIncrementLabel(ex.unit, ex.amount)}
              </button>
            ))}
          </div>
          <div className="movement-custom-row">
            <input
              className="movement-custom-input movement-custom-input-wide"
              placeholder="Exercise name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <input
              className="movement-custom-input"
              type="number"
              min={0}
              value={customAmount}
              onChange={(e) => setCustomAmount(Number(e.target.value))}
            />
            <select
              className="movement-custom-input"
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value as ExerciseUnit)}
            >
              <option value="reps">reps</option>
              <option value="seconds">sec</option>
              <option value="minutes">min</option>
            </select>
            <button type="button" className="movement-log-btn" onClick={handleCustomAdd}>
              Log
            </button>
          </div>
        </div>
      ) : null}

      {movementTotals.length > 0 ? (
        <div className="movement-totals">
          <div className="movement-region">
            <p className="movement-region-title">Today&apos;s movement</p>
            {movementTotals.map((agg) => (
              <div key={agg.id} className="movement-region-row">
                {formatExerciseRunAggLine(agg)}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
