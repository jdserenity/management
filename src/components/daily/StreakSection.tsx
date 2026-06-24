// src/components/daily/StreakSection.tsx

import { useCallback, useEffect, useState } from 'react';
import StreakActivityRow from '@/components/daily/StreakActivityRow';
import { StreakDailyHeatmap, StreakWeeklyHeatmap } from '@/components/daily/StreakHeatmaps';
import { buildActivityCatalog } from '@/lib/streak/activityCatalog';
import { fireDayCompleteConfetti } from '@/lib/streak/confetti';
import { isDayComplete } from '@/lib/streak/heatmapHelpers';
import { isTauri } from '@/lib/isTauri';
import { loadStreakHeatmapColorPref } from '@/lib/streakHeatmapPref';
import type { StreakLogState, StreakState } from '@/lib/streak/types';
import {
  archiveStreakActivity,
  loadStreakState,
  resetStreakActivity,
  saveStreakLog,
  setActivityPaused,
  updateStreakActivityDescription
} from '@/lib/streakDb';
import './streak.css';

export default function StreakSection() {
  const [state, setState] = useState<StreakState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [heatmapColor, setHeatmapColor] = useState<string | null>(null);
  const [heatmapYear, setHeatmapYear] = useState(() => new Date().getFullYear());

  const refresh = useCallback(async () => {
    if (!isTauri()) {
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
    return () => window.clearInterval(id);
  }, [refresh]);

  const handleLog = async (activityId: string, newState: StreakLogState | null, day?: string) => {
    if (!state) return;
    const targetDay = day || state.currentDay;
    const catalog = buildActivityCatalog(state.config, state.data);
    const wasComplete = isDayComplete(state.data, catalog, targetDay);
    const next = await saveStreakLog(state, activityId, newState, day);
    const nowComplete = isDayComplete(next.data, buildActivityCatalog(next.config, next.data), targetDay);
    if (!wasComplete && nowComplete && newState === 'success') fireDayCompleteConfetti();
    setState(next);
  };

  if (!isTauri()) {
    return (
      <section className="streak-tracker-container" aria-label="Habits">
        <p className="streak-tracker-empty text-sm">Run <code className="text-foreground">npm run tauri dev</code> for SQLite and Tauri APIs. Plain <code className="text-foreground">npm run dev</code> is browser-only and cannot load habits data.</p>
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
                onPause={(id, paused) => void setActivityPaused(state, id, paused).then(setState)}
                onReset={(id) => void resetStreakActivity(state, id).then(setState)}
                onArchive={(id) => void archiveStreakActivity(state, id).then(setState)}
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
                onPause={(id, paused) => void setActivityPaused(state, id, paused).then(setState)}
                onReset={(id) => void resetStreakActivity(state, id).then(setState)}
                onArchive={(id) => void archiveStreakActivity(state, id).then(setState)}
                onEditDescription={(id, desc) => void updateStreakActivityDescription(state, id, desc).then(setState)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
