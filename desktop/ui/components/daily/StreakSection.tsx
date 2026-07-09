// src/components/daily/StreakSection.tsx

import { useCallback, useState } from 'react';
import StreakActivityRow from '@/components/daily/StreakActivityRow';
import { StreakDailyHeatmap, StreakWeeklyHeatmap } from '@/components/daily/StreakHeatmaps';
import { useSession } from '@/context/SessionContext';
import { buildActivityCatalog } from '@/lib/streak/activityCatalog';
import { fireDayCompleteConfetti } from '@/lib/streak/display';
import { isDayComplete } from '@/lib/streak/heatmap';
import { useAppDataLoad } from '@/lib/useAppDataLoad';
import { movementSnackLogsToday } from '@/lib/movementSnack/movementSnack';
import { loadStreakHeatmapColorPref } from '@/lib/streakHeatmapPref';
import type { StreakLogState, StreakState } from '@/lib/streak/types';
import {
  loadStreakState,
  saveStreakLog,
  updateStreakActivityDescription
} from '@/lib/streakDb';
import { activeEntries, isStapleLogged } from '@/lib/tdee/entries';
import { addCustomEntry, addStapleEntry, loadTdeeFile, removeTdeeEntry } from '@/lib/tdeeDb';
import { activeEntries as activeWaterEntries } from '@/lib/water/entries';
import { addWaterEntry, loadWaterFile, removeWaterEntry } from '@/lib/waterDb';
import './streak.css';

type Props = {
  refreshKey?: number;
  onCrossLog?: (kind: 'tdee' | 'water' | 'movement') => void;
};

type StreakBundle = { state: StreakState; heatmapColor: string | null };

export default function StreakSection({ refreshKey, onCrossLog }: Props) {
  const { logMovementSnackCompletion, removeWorkoutLog, workoutLogs, dayRolloverHour } = useSession();
  const loadBundle = useCallback(async (): Promise<StreakBundle> => {
    const [state, heatmapColor] = await Promise.all([loadStreakState(), loadStreakHeatmapColorPref()]);
    return { state, heatmapColor };
  }, []);
  const { data, loadError, setData, storageReady } = useAppDataLoad(loadBundle, 'Failed to load habits', { refreshKey });
  const state = data?.state ?? null;
  const heatmapColor = data?.heatmapColor ?? null;
  const setState = (next: StreakState | ((prev: StreakState | null) => StreakState | null)) => {
    setData((bundle) => {
      const prev = bundle?.state ?? null;
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (!resolved) return null;
      return { state: resolved, heatmapColor: bundle?.heatmapColor ?? null };
    });
  };
  const [heatmapYear, setHeatmapYear] = useState(() => new Date().getFullYear());

  const handleLog = async (activityId: string, newState: StreakLogState | null, day?: string) => {
    if (!state) return;
    const targetDay = day || state.currentDay;
    const catalog = buildActivityCatalog(state.config, state.data);
    const wasComplete = isDayComplete(state.data, catalog, targetDay);
    const activity = state.config.activities.find((a) => a.id === activityId);
    const next = await saveStreakLog(state, activityId, newState, day);
    const nowComplete = isDayComplete(next.data, buildActivityCatalog(next.config, next.data), targetDay);
    if (!wasComplete && nowComplete && newState === 'success') fireDayCompleteConfetti();

    // Linked partners act in lockstep with this task (same mental object, two UIs).
    if (newState === 'success' && activity) {
      if (activity.linkedStapleId) {
        const tdeeFile = await loadTdeeFile();
        if (!isStapleLogged(tdeeFile.entries, activity.linkedStapleId)) {
          const staple = tdeeFile.staples.find((s) => s.id === activity.linkedStapleId);
          if (staple) await addStapleEntry(tdeeFile, staple);
        }
        onCrossLog?.('tdee');
      } else if (activity.extraCalories) {
        const tdeeFile = await loadTdeeFile();
        await addCustomEntry(tdeeFile, activity.name || activity.id, activity.extraCalories, activity.extraProtein ?? 0, 1);
        onCrossLog?.('tdee');
      }
      if (activity.linkedWater) {
        const waterFile = await loadWaterFile();
        if (activeWaterEntries(waterFile.entries).length === 0) {
          const ml = activity.extraWaterMl && activity.extraWaterMl > 0 ? activity.extraWaterMl : 500;
          await addWaterEntry(waterFile, activity.name || activity.id, ml, 1);
        }
        onCrossLog?.('water');
      } else if (activity.extraWaterMl) {
        const waterFile = await loadWaterFile();
        await addWaterEntry(waterFile, activity.name || activity.id, activity.extraWaterMl, 1);
        onCrossLog?.('water');
      }
      if (activity.linkedMovementBurst) {
        const snacks = movementSnackLogsToday(workoutLogs, Date.now(), dayRolloverHour);
        if (snacks.length === 0) logMovementSnackCompletion(false);
        onCrossLog?.('movement');
      }
    }

    if ((newState == null || newState === 'none') && activity) {
      if (activity.linkedStapleId) {
        let tdeeFile = await loadTdeeFile();
        const stapleEntries = activeEntries(tdeeFile.entries).filter(
          (e) => e.kind === 'staple' && e.refId === activity.linkedStapleId
        );
        for (const entry of stapleEntries) {
          tdeeFile = await removeTdeeEntry(tdeeFile, entry.id);
        }
        onCrossLog?.('tdee');
      }
      if (activity.linkedWater) {
        let waterFile = await loadWaterFile();
        for (const entry of activeWaterEntries(waterFile.entries)) {
          waterFile = await removeWaterEntry(waterFile, entry.id);
        }
        onCrossLog?.('water');
      }
      if (activity.linkedMovementBurst) {
        const snacks = movementSnackLogsToday(workoutLogs, Date.now(), dayRolloverHour);
        for (const log of snacks) removeWorkoutLog(log.id);
        onCrossLog?.('movement');
      }
    }

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

  const dailyActivities = state.config.activities.filter((a) => a.frequency !== 'weekly');
  const weeklyActivities = state.config.activities.filter((a) => a.frequency === 'weekly');

  return (
    <section className="streak-tracker-container" aria-label="Habits">
      {dailyActivities.length === 0 && weeklyActivities.length === 0 ? (
        <p className="streak-tracker-empty mb-4">No habits yet. Add activities in Customize → Habits.</p>
      ) : (
        <>
          <StreakDailyHeatmap state={state} year={heatmapYear} onYearChange={setHeatmapYear} heatmapColor={heatmapColor} />
          <StreakWeeklyHeatmap state={state} year={heatmapYear} onYearChange={setHeatmapYear} />
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
