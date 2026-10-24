// src/components/daily/StreakSection.tsx

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import StreakActivityRow from '@/components/daily/StreakActivityRow';
import { StreakMonthlyCalendar } from '@/components/daily/StreakHeatmaps';
import { useSession } from '@/context/SessionContext';
import { buildActivityCatalog } from '@/lib/streak/activityCatalog';
import { fireDayCompleteConfetti } from '@/lib/streak/display';
import { becameDayComplete, getUnbrokenChainDates, isUnbrokenChainMode } from '@/lib/streak/heatmap';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import { buildSnackProgress, movementSnackDayKey, movementSnackLogsToday, movementSnackPlanForTimestamp } from '@/lib/movementSnack/movementSnack';
import type { StreakLogState, StreakState } from '@/lib/streak/types';
import { dayEndTimeFromRolloverHour } from '@/lib/streak/dates';
import {
  applyStreakLogLocally,
  loadStreakState,
  reconcileTrackerLinkedStreakActivities,
  saveStreakLog,
  updateStreakActivityDescription
} from '@/lib/streakDb';
import { totalCalories, totalProtein } from '@/lib/tdee/totals';
import { loadTdeeFile } from '@/lib/tdeeDb';
import { totalWater } from '@/lib/water/totals';
import { loadWaterFile } from '@/lib/waterDb';
import './streak.css';

type Props = {
  refreshKey?: number;
  /** Called when unbroken-chain mode (2+ consecutive complete days) turns on or off. */
  onUnbrokenChainModeChange?: (active: boolean) => void;
  /** Rendered between the calendar and the task list (the Food/Water carousel on Daily). */
  trackerWidget?: ReactNode;
};

type StreakBundle = { state: StreakState };

export default function StreakSection({ refreshKey, onUnbrokenChainModeChange, trackerWidget }: Props) {
  const { movementSnackPrefs, workoutLogs, dayRolloverHour } = useSession();
  const loadBundle = useCallback(async (): Promise<StreakBundle> => {
    return { state: await loadStreakState() };
  }, []);
  const { data, loadError, setData, storageReady } = useAppDataLoad(loadBundle, 'Failed to load habits', { refreshKey });
  const state = data?.state ?? null;
  const setState = (next: StreakState | ((prev: StreakState | null) => StreakState | null)) => {
    setData((bundle) => {
      const prev = bundle?.state ?? null;
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (!resolved) return null;
      return { state: resolved };
    });
  };
  const [calendarMonth, setCalendarMonth] = useState<string | null>(null);
  const trackerLinkedSignature = state?.config.activities.map((activity) => `${activity.id}:${activity.trackerLinkedKind || ''}:${activity.enabled !== false}`).join('|') || '';
  const workoutProgress = useMemo(() => {
    const tasks = movementSnackPlanForTimestamp(Date.now(), dayRolloverHour, movementSnackPrefs.movePool, movementSnackPrefs.regimen);
    const day = state?.currentDay || movementSnackDayKey(Date.now(), dayRolloverHour);
    const logs = movementSnackLogsToday(workoutLogs, Date.now(), dayRolloverHour);
    return buildSnackProgress(tasks, logs, day);
  }, [dayRolloverHour, movementSnackPrefs.movePool, movementSnackPrefs.regimen, state?.currentDay, workoutLogs]);

  const unbrokenChainActive = useMemo(() => {
    if (!state) return false;
    const catalog = buildActivityCatalog(state.config, state.data);
    return isUnbrokenChainMode(getUnbrokenChainDates(state.data, catalog, state.currentDay));
  }, [state]);

  useEffect(() => {
    onUnbrokenChainModeChange?.(unbrokenChainActive);
  }, [onUnbrokenChainModeChange, unbrokenChainActive]);

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    void Promise.all([loadTdeeFile(), loadWaterFile()]).then(async ([food, water]) => {
      const next = await reconcileTrackerLinkedStreakActivities(state, {
        food: { calories: totalCalories(food.entries), calorieTarget: food.tdee, protein: totalProtein(food.entries), proteinTarget: food.protein },
        water: { totalMl: totalWater(water.entries), targetMl: water.targetMl },
        workout: workoutProgress
      });
      if (cancelled || next === state) return;
      // Tracker-linked tasks can't be tapped, so they bypass handleLog — celebrate here when one of them finishes the day.
      if (becameDayComplete(state.data, buildActivityCatalog(state.config, state.data), next.data, buildActivityCatalog(next.config, next.data), state.currentDay)) fireDayCompleteConfetti();
      setState(next);
    }).catch((error) => console.error('Failed to refresh tracker-linked tasks:', error));
    return () => { cancelled = true; };
  }, [trackerLinkedSignature, refreshKey, state, workoutProgress]);

  const [actionError, setActionError] = useState<string | null>(null);

  const handleLog = async (activityId: string, newState: StreakLogState | null, day?: string) => {
    if (!state) return;
    const targetDay = day || state.currentDay;
    const activity = state.config.activities.find((a) => a.id === activityId);
    if (activity?.trackerLinkedKind) return;
    // Show the check right away; roll it back with a visible error if the save fails.
    const optimistic = applyStreakLogLocally(state, activityId, newState, day, dayEndTimeFromRolloverHour(dayRolloverHour));
    setState(optimistic);
    setActionError(null);
    try {
      const next = await saveStreakLog(state, activityId, newState, day);
      if (newState === 'success' && becameDayComplete(state.data, buildActivityCatalog(state.config, state.data), next.data, buildActivityCatalog(next.config, next.data), targetDay)) fireDayCompleteConfetti();
      setState(next);
    } catch (error) {
      console.error('Failed to save habit check:', error);
      setState(state);
      setActionError(`Could not save that check — your habits were not changed. ${error instanceof Error ? error.message : ''}`.trim());
    }
  };

  if (!storageReady) {
    return (
      <section className="streak-tracker-container" aria-label="Habits">
        <p className="streak-tracker-empty text-sm">Storage is not ready yet.</p>
      </section>
    );
  }

  if (loadError) return <p className="streak-tracker-empty">Could not load habits: {loadError}</p>;
  if (!state) return <p className="streak-tracker-empty">Loading habits…</p>;

  const dailyActivities = state.config.activities.filter((a) => a.enabled !== false && a.frequency !== 'weekly');
  const weeklyActivities = state.config.activities.filter((a) => a.enabled !== false && a.frequency === 'weekly');

  return (
    <section className="streak-tracker-container" aria-label="Habits">
      {actionError ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}
      <StreakMonthlyCalendar state={state} month={calendarMonth ?? state.currentDay.slice(0, 7)} onMonthChange={setCalendarMonth} />
      {trackerWidget}
      {dailyActivities.length === 0 && weeklyActivities.length === 0 ? (
        <p className="streak-tracker-empty mb-4">No habits yet. Add activities in Customize → Habits.</p>
      ) : (
        <>
          <div className="streak-activities">
            {dailyActivities.length > 0 && weeklyActivities.length > 0 ? <div className="streak-section-label">Daily</div> : null}
            {dailyActivities.map((a) => (
              <StreakActivityRow
                key={a.id}
                activity={a}
                state={state}
                onLog={(id, s, d) => void handleLog(id, s, d)}
                onEditDescription={(id, desc) => void updateStreakActivityDescription(state, id, desc).then(setState)}
              />
            ))}
            {weeklyActivities.length > 0 ? <div className="streak-section-label">Weekly</div> : null}
            {weeklyActivities.map((a) => (
              <StreakActivityRow
                key={a.id}
                activity={a}
                state={state}
                onLog={(id, s, d) => void handleLog(id, s, d)}
                onEditDescription={(id, desc) => void updateStreakActivityDescription(state, id, desc).then(setState)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
