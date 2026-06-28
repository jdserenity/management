// src/components/daily/StreakSection.tsx

import { useCallback, useEffect, useState } from 'react';
import StreakActivityRow from '@/components/daily/StreakActivityRow';
import { StreakDailyHeatmap, StreakWeeklyHeatmap } from '@/components/daily/StreakHeatmaps';
import { buildActivityCatalog } from '@/lib/streak/activityCatalog';
import { fireDayCompleteConfetti } from '@/lib/streak/confetti';
import { isDayComplete } from '@/lib/streak/heatmapHelpers';
import { hasAppStorage, getAppKind } from '@/lib/appRuntime';
import { loadStreakHeatmapColorPref } from '@/lib/streakHeatmapPref';
import type { StreakLogState, StreakState } from '@/lib/streak/types';
import {
  loadStreakState,
  saveStreakLog,
  updateStreakActivityDescription
} from '@/lib/streakDb';
import { addCustomEntry, loadTdeeFile } from '@/lib/tdeeDb';
import { addWaterEntry, loadWaterFile } from '@/lib/waterDb';
import './streak.css';

type Props = {
  onCrossLog?: (kind: 'tdee' | 'water') => void;
};

export default function StreakSection({ onCrossLog }: Props) {
  const [state, setState] = useState<StreakState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [heatmapColor, setHeatmapColor] = useState<string | null>(null);
  const [heatmapYear, setHeatmapYear] = useState(() => new Date().getFullYear());

  const refresh = useCallback(async () => {
    if (!hasAppStorage()) {
      setLoadError(null);
      setState(null);
      return;
    }
    try {
      setLoadError(null);
      const [next, color] = await Promise.all([loadStreakState(), loadStreakHeatmapColorPref()]);
      setHeatmapColor(color);
      setState(next);
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load habits');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    const onRemoteRefresh = () => { void refresh(); };
    if (getAppKind() === 'companion') window.addEventListener('mgmt-companion-data-refresh', onRemoteRefresh);
    return () => {
      window.clearInterval(id);
      if (getAppKind() === 'companion') window.removeEventListener('mgmt-companion-data-refresh', onRemoteRefresh);
    };
  }, [refresh]);

  const handleLog = async (activityId: string, newState: StreakLogState | null, day?: string) => {
    if (!state) return;
    const targetDay = day || state.currentDay;
    const catalog = buildActivityCatalog(state.config, state.data);
    const wasComplete = isDayComplete(state.data, catalog, targetDay);
    const next = await saveStreakLog(state, activityId, newState, day);
    const nowComplete = isDayComplete(next.data, buildActivityCatalog(next.config, next.data), targetDay);
    if (!wasComplete && nowComplete && newState === 'success') fireDayCompleteConfetti();
    if (newState === 'success') {
      const activity = next.config.activities.find((a) => a.id === activityId);
      if (activity?.extraCalories) {
        const tdeeFile = await loadTdeeFile();
        await addCustomEntry(tdeeFile, activity.name || activity.id, activity.extraCalories, activity.extraProtein ?? 0, 1);
        onCrossLog?.('tdee');
      }
      if (activity?.extraWaterMl) {
        const waterFile = await loadWaterFile();
        await addWaterEntry(waterFile, activity.name || activity.id, activity.extraWaterMl, 1);
        onCrossLog?.('water');
      }
    }
    setState(next);
  };

  if (!hasAppStorage()) {
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
