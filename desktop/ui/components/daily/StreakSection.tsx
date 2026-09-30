// src/components/daily/StreakSection.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import StreakActivityRow from '@/components/daily/StreakActivityRow';
import { StreakMonthlyCalendar } from '@/components/daily/StreakHeatmaps';
import { useSession } from '@/context/SessionContext';
import { buildActivityCatalog } from '@/lib/streak/activityCatalog';
import { fireDayCompleteConfetti } from '@/lib/streak/display';
import { isDayComplete } from '@/lib/streak/heatmap';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import { movementSnackLogsToday } from '@/lib/movementSnack/movementSnack';
import { movementSnackPlanForTimestamp } from '@/lib/movementSnack/movementSnack';
import type { StreakLogState, StreakState } from '@/lib/streak/types';
import {
  loadStreakState,
  reconcileAutomaticStreakActivities,
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
};

type StreakBundle = { state: StreakState };

export default function StreakSection({ refreshKey }: Props) {
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
  const automaticSignature = state?.config.activities.map((activity) => `${activity.id}:${activity.automaticKind || ''}:${activity.enabled !== false}`).join('|') || '';
  const workoutProgress = useMemo(() => {
    const tasks = movementSnackPlanForTimestamp(Date.now(), dayRolloverHour, movementSnackPrefs.movePool, movementSnackPrefs.regimen);
    const day = state?.currentDay || '';
    const logs = movementSnackLogsToday(workoutLogs, Date.now(), dayRolloverHour);
    const completedTasks = tasks.filter((task) => logs.filter((log) => log.movementSnack?.day === day && log.movementSnack.slotId === task.slotId).length >= task.setCount).length;
    return { completedTasks, totalTasks: tasks.length };
  }, [dayRolloverHour, movementSnackPrefs.movePool, movementSnackPrefs.regimen, state?.currentDay, workoutLogs]);

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    void Promise.all([loadTdeeFile(), loadWaterFile()]).then(async ([food, water]) => {
      const next = await reconcileAutomaticStreakActivities(state, {
        food: { calories: totalCalories(food.entries), calorieTarget: food.tdee, protein: totalProtein(food.entries), proteinTarget: food.protein },
        water: { totalMl: totalWater(water.entries), targetMl: water.targetMl },
        workout: workoutProgress
      });
      if (!cancelled && next !== state) setState(next);
    }).catch((error) => console.error('Failed to refresh automatic tasks:', error));
    return () => { cancelled = true; };
  }, [automaticSignature, refreshKey, state, workoutProgress]);

  const handleLog = async (activityId: string, newState: StreakLogState | null, day?: string) => {
    if (!state) return;
    const targetDay = day || state.currentDay;
    const catalog = buildActivityCatalog(state.config, state.data);
    const wasComplete = isDayComplete(state.data, catalog, targetDay);
    const activity = state.config.activities.find((a) => a.id === activityId);
    if (activity?.automaticKind) return;
    const next = await saveStreakLog(state, activityId, newState, day);
    const nowComplete = isDayComplete(next.data, buildActivityCatalog(next.config, next.data), targetDay);
    if (!wasComplete && nowComplete && newState === 'success') fireDayCompleteConfetti();

    setState(next);
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
      {dailyActivities.length === 0 && weeklyActivities.length === 0 ? (
        <p className="streak-tracker-empty mb-4">No habits yet. Add activities in Customize → Habits.</p>
      ) : (
        <>
          <StreakMonthlyCalendar state={state} month={calendarMonth ?? state.currentDay.slice(0, 7)} onMonthChange={setCalendarMonth} />
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
