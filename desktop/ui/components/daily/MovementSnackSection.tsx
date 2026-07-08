// src/components/daily/MovementSnackSection.tsx

import { useMemo, useState, type ReactNode } from 'react';
import { useSession } from '@/context/SessionContext';
import { hasAppStorage } from '@/lib/appRuntime';
import { movementSnackLogsToday } from '@/lib/movementSnack/movementSnack';
import TdeeChainConnector from '@/components/daily/TdeeChainConnector';
import {
  DASHBOARD_MANUAL_EXERCISES,
  DASHBOARD_TODAY_STRETCH_ROWS,
  formatExerciseAmount,
  formatExerciseRunAggLine,
  groupTodayMovementByRegion,
  type ExerciseDefinition,
  type ExerciseUnit
} from '@/lib/workoutPlanner';
import './movement.css';

const snackChipLabel = (workoutName: string): string => {
  if (workoutName.includes('· easy')) return 'Easy snack';
  if (workoutName.includes('· hard')) return 'Hard snack';
  return 'Snack';
};

const manualIncrementLabel = (unit: ExerciseUnit, amount: number) => {
  if (unit === 'reps') return `+${amount}`;
  if (unit === 'seconds') return `+${amount}s`;
  return `+${amount}m`;
};

export default function MovementSnackSection() {
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
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState(10);
  const [customUnit, setCustomUnit] = useState<ExerciseUnit>('reps');

  const goal = movementSnackPrefs.dailyGoal;
  const done = todayMovementSnacks;
  const ratio = goal > 0 ? Math.min(1, done / goal) : 0;
  const complete = done >= goal;

  const snackLogs = useMemo(
    () => movementSnackLogsToday(workoutLogs, Date.now(), dayRolloverHour),
    [workoutLogs, dayRolloverHour]
  );

  const regions = useMemo(
    () => groupTodayMovementByRegion(todayExerciseTotals, todayStretchTotals),
    [todayExerciseTotals, todayStretchTotals]
  );

  if (!hasAppStorage()) return null;
  if (!sessionStorageReady) return <p className="movement-tracker-empty">Loading movement…</p>;

  const handleCustomAdd = () => {
    const name = customName.trim();
    if (!name) return;
    const exercise: ExerciseDefinition = {
      id: `manual-${Date.now()}`,
      name,
      amount: Math.max(0, Math.round(customAmount)),
      unit: customUnit
    };
    addManualExercise(exercise);
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
        title="Log hard snack"
        onClick={() => logMovementSnackCompletion(false)}
      >
        <span className="movement-chain-label">Hard</span>
      </button>
    );
    chainItems.push(<TdeeChainConnector key="c-hard-easy" />);
    chainItems.push(
      <button
        key="easy"
        type="button"
        className="movement-chain-btn"
        title="Log easy snack"
        onClick={() => logMovementSnackCompletion(true)}
      >
        <span className="movement-chain-label">Easy</span>
      </button>
    );
  }

  snackLogs.forEach((log, i) => {
    const withConnector = chainItems.length > 0 || i > 0;
    chainItems.push(
      withConnector ? <TdeeChainConnector key={`c-snack-${log.id}`} /> : null,
      <button
        key={log.id}
        type="button"
        className="movement-chain-btn movement-chain-done"
        title="Click to remove"
        onClick={() => removeWorkoutLog(log.id)}
      >
        <span className="movement-chain-label">{snackChipLabel(log.workoutName)}</span>
      </button>
    );
  });

  if (chainItems.length > 0) chainItems.push(<TdeeChainConnector key="c-plus" />);
  chainItems.push(
    <button
      key="plus"
      type="button"
      className={`movement-chain-btn movement-chain-plus${addMode ? ' movement-chain-plus-disabled' : ''}`}
      title={addMode ? 'Close add menu first' : 'Log an exercise'}
      disabled={addMode}
      onClick={() => setAddMode(true)}
    >
      +
    </button>
  );

  return (
    <section className="movement-tracker-container" aria-label="Movement snacks">
      <div className="movement-summary">
        <div className="movement-counts">
          <span>{done}</span>
          <span className="movement-sep"> / </span>
          <span className="movement-target">{goal} snacks today</span>
        </div>
        <div className={`movement-remaining${complete ? ' movement-remaining-done' : ''}`}>
          {complete ? 'Goal reached' : `${goal - done} snack${goal - done === 1 ? '' : 's'} left`}
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
            <span className="movement-add-title">Log exercise</span>
            <button type="button" className="movement-add-close" title="Close" aria-label="Close" onClick={() => setAddMode(false)}>
              ×
            </button>
          </div>
          <div className="movement-snack-quick">
            <button type="button" className="movement-quick-btn movement-quick-btn-primary" onClick={() => { logMovementSnackCompletion(false); setAddMode(false); }}>
              Hard snack
            </button>
            <button type="button" className="movement-quick-btn movement-quick-btn-primary" onClick={() => { logMovementSnackCompletion(true); setAddMode(false); }}>
              Easy snack
            </button>
          </div>
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

      <div className="movement-regions">
        {DASHBOARD_TODAY_STRETCH_ROWS.map((row) => {
          const items = row.region === 'upper' ? regions.upper : regions.lower;
          return (
            <div key={row.region} className="movement-region">
              <p className="movement-region-title">{row.label}</p>
              {items.length === 0 ? (
                <p className="movement-region-empty">Nothing logged yet today.</p>
              ) : (
                items.map((agg) => (
                  <div key={agg.id} className="movement-region-row">
                    {agg.id.startsWith('__stretch-')
                      ? `${agg.label}: ${formatExerciseAmount({ id: agg.id, name: agg.label, amount: agg.timedSeconds, unit: 'seconds' })}`
                      : formatExerciseRunAggLine(agg)}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
