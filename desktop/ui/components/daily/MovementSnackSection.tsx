// src/components/daily/MovementSnackSection.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '@/context/SessionContext';
import { hasAppStorage } from '@/lib/appRuntime';
import { isEasyMovementSnackLog, movementSnackLogsToday } from '@/lib/movementSnack/movementSnack';
import { formatNearestHalfHourLabel } from '@/lib/movementSnack/nearestHalfHour';
import {
  defaultQuickLogEntryForExercise,
  formatQuickLogIncrementLabel,
  listPickableCatalogExercises,
  quickLogEntryForId,
  removeQuickLogExercise,
  upsertQuickLogExercise
} from '@/lib/movementSnack/movementSnackQuickLog';
import {
  completeTasksLinkedToMovementBurst,
  uncompleteTasksLinkedToMovementBurst
} from '@/lib/streak/crossLinks';
import {
  buildTrackerChain,
  TrackerAddPanel,
  TrackerPlusButton,
  TrackerSummary
} from '@/components/daily/TrackerChain';
import {
  formatExerciseRunAggLine,
  listTodayMovementTotals,
  type ExerciseDefinition,
  type ExerciseUnit
} from '@/lib/workoutPlanner';
import './movement.css';

const cloneExercises = (exercises: ExerciseDefinition[]): ExerciseDefinition[] =>
  exercises.map((ex) => ({ ...ex }));

type Props = {
  onLinkedTaskComplete?: () => void;
};

export default function MovementSnackSection({ onLinkedTaskComplete }: Props) {
  const {
    movementSnackPrefs,
    workoutCustomizePrefs,
    todayMovementSnacks,
    todayExerciseTotals,
    todayStretchTotals,
    workoutLogs,
    dayRolloverHour,
    logMovementSnackCompletion,
    addManualExercise,
    removeWorkoutLog,
    updateMovementSnackPrefs,
    sessionStorageReady
  } = useSession();

  const [addMode, setAddMode] = useState(false);
  const [hardDraft, setHardDraft] = useState<ExerciseDefinition[]>(() => cloneExercises(movementSnackPrefs.hardExercises));
  const [easyDraft, setEasyDraft] = useState<ExerciseDefinition[]>(() => cloneExercises(movementSnackPrefs.easyExercises));
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState(10);
  const [customUnit, setCustomUnit] = useState<ExerciseUnit>('reps');
  const [addQuickId, setAddQuickId] = useState('');

  const quickLogExercises = movementSnackPrefs.quickLogExercises;
  const catalogExercises = useMemo(
    () => listPickableCatalogExercises(workoutCustomizePrefs),
    [workoutCustomizePrefs]
  );
  const catalogNotInQuickLog = useMemo(
    () => catalogExercises.filter((ex) => !quickLogEntryForId(movementSnackPrefs, ex.id)),
    [catalogExercises, movementSnackPrefs]
  );

  useEffect(() => {
    if (!addMode) return;
    setHardDraft(cloneExercises(movementSnackPrefs.hardExercises));
    setEasyDraft(cloneExercises(movementSnackPrefs.easyExercises));
  }, [addMode, movementSnackPrefs.hardExercises, movementSnackPrefs.easyExercises]);

  useEffect(() => {
    if (catalogNotInQuickLog.length === 0) {
      setAddQuickId('');
      return;
    }
    if (!catalogNotInQuickLog.some((ex) => ex.id === addQuickId)) {
      setAddQuickId(catalogNotInQuickLog[0].id);
    }
  }, [catalogNotInQuickLog, addQuickId]);

  const persistQuickLog = useCallback(
    (next: ExerciseDefinition[]) => updateMovementSnackPrefs({ quickLogExercises: next }),
    [updateMovementSnackPrefs]
  );

  const updateQuickLogAmount = useCallback(
    (index: number, amount: number) => {
      const rounded = Math.max(0, Math.round(amount));
      persistQuickLog(quickLogExercises.map((ex, i) => (i === index ? { ...ex, amount: rounded } : ex)));
    },
    [persistQuickLog, quickLogExercises]
  );

  const removeQuickLogRow = useCallback(
    (exerciseId: string) => persistQuickLog(removeQuickLogExercise(quickLogExercises, exerciseId)),
    [persistQuickLog, quickLogExercises]
  );

  const addQuickFromCatalog = useCallback(() => {
    const picked = catalogExercises.find((ex) => ex.id === addQuickId);
    if (!picked || quickLogEntryForId(movementSnackPrefs, picked.id)) return;
    persistQuickLog(upsertQuickLogExercise(quickLogExercises, defaultQuickLogEntryForExercise(picked)));
  }, [addQuickId, catalogExercises, movementSnackPrefs, persistQuickLog, quickLogExercises]);

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

  const chips = [
    ...(!addMode
      ? [
          <button
            key="hard"
            type="button"
            className="movement-chain-btn"
            title="Log hard movement burst"
            onClick={handleLogHard}
          >
            <span className="movement-chain-label">Hard burst</span>
          </button>
        ]
      : []),
    ...snackLogs.map((log) => {
      const easy = isEasyMovementSnackLog(log);
      const timeLabel = formatNearestHalfHourLabel(log.completedAt);
      return (
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
    })
  ];
  const chainItems = buildTrackerChain({
    chips,
    plus: (
      <TrackerPlusButton
        key="plus"
        prefix="movement"
        addMode={addMode}
        onOpen={() => setAddMode(true)}
        titleClosed="Log exercise or modified burst"
      />
    )
  });

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
      <TrackerSummary
        prefix="movement"
        today={done}
        target={<>{goal} movement bursts today</>}
        remainingText={complete ? 'Goal reached' : `${goal - done} movement burst${goal - done === 1 ? '' : 's'} left`}
        remainingClass={complete ? ' movement-remaining-done' : ''}
        progressRatio={ratio}
        showProgress={goal > 0}
      />
      <div className="movement-chain">{chainItems}</div>
      {addMode ? (
        <TrackerAddPanel prefix="movement" title="Log movement" onClose={() => setAddMode(false)}>
          {renderSnackEditor('hard', hardDraft, true)}
          {renderSnackEditor('easy', easyDraft, false)}
          <div className="movement-snack-editor">
            <p className="movement-snack-editor-title">One-tap exercises</p>
            <p className="plugin-muted text-xs" style={{ margin: '0 0 8px' }}>Each button logs one hit at the size you set. Customize → Exercises mirrors this list.</p>
            <ul className="movement-snack-editor-rows">
              {quickLogExercises.map((ex, index) => (
                <li key={ex.id} className="movement-snack-editor-row">
                  <span className="movement-snack-editor-name">{ex.name}</span>
                  <label className="movement-snack-editor-amount">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="movement-custom-input"
                      value={ex.amount}
                      onChange={(e) => updateQuickLogAmount(index, Number(e.target.value))}
                    />
                    <span className="movement-snack-editor-unit">{ex.unit === 'reps' ? 'reps' : ex.unit === 'seconds' ? 'sec' : 'min'}</span>
                  </label>
                  <button type="button" className="movement-quick-btn" onClick={() => removeQuickLogRow(ex.id)} title="Remove from one-tap list">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {catalogNotInQuickLog.length > 0 ? (
              <div className="movement-custom-row">
                <select className="movement-custom-input movement-custom-input-wide" value={addQuickId} onChange={(e) => setAddQuickId(e.target.value)}>
                  {catalogNotInQuickLog.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
                <button type="button" className="movement-log-btn" onClick={addQuickFromCatalog}>Add</button>
              </div>
            ) : null}
          </div>
          <div className="movement-snack-quick">
            {quickLogExercises.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="movement-quick-btn"
                onClick={() => { addManualExercise(ex); setAddMode(false); }}
              >
                {ex.name} {formatQuickLogIncrementLabel(ex.unit, ex.amount)}
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
        </TrackerAddPanel>
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
