import { useEffect, useMemo, useState } from 'react';
import {
  formatExerciseRunAggLine,
  formatTimedMovementHeadline,
  listNonZeroExerciseTotals,
  type PeriodStatsPoint
} from '@/lib/workoutPlanner';
import StatsProgressChart, { toChartRows, type StatsChartRow } from '@/components/stats/StatsProgressChart';
import { statsChartShellClass } from '@/lib/statsChartLayout';

const focusMinutesLabel = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const exerciseEmoji = (id: string): string => {
  if (id.startsWith('stretch-')) return '🧘';
  if (id === 'pushups') return '💪';
  if (id === 'jacks') return '🤸';
  if (id === 'squats') return '🦵';
  if (id === 'march') return '🚶‍♂️';
  if (id === 'shadow') return '🥊';
  return '🏋️';
};

const StatTile = ({ emoji, value, label }: { emoji: string; value: string; label: string }) => (
  <div className="plugin-stat-block">
    <p className="text-lg leading-none">{emoji}</p>
    <p className="plugin-counts mt-1 text-xl">{value}</p>
    <p className="plugin-muted mt-0.5 text-[10px] font-semibold uppercase tracking-wide">{label}</p>
  </div>
);

type StatsPeriodExplorerProps = {
  series: PeriodStatsPoint[];
  periodTitle: (bucket: string) => string;
  chartLabel: (bucket: string) => string;
  exercisesForBucket: (bucket: string) => ReturnType<typeof listNonZeroExerciseTotals>;
};

const StatsPeriodExplorer = ({ series, periodTitle, chartLabel, exercisesForBucket }: StatsPeriodExplorerProps) => {
  const chartData: StatsChartRow[] = useMemo(() => toChartRows(series, chartLabel), [series, chartLabel]);
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, series.length - 1));

  useEffect(() => {
    setSelectedIndex(Math.max(0, series.length - 1));
  }, [series]);

  const selected = series[selectedIndex];
  const exercises = selected ? exercisesForBucket(selected.bucket) : [];
  const canGoOlder = selectedIndex > 0;
  const canGoNewer = selectedIndex < series.length - 1;

  if (!selected) {
    return <p className="plugin-panel-flat border-dashed plugin-empty py-12 text-center">✨ No activity in this range yet — start a session on Work!</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden lg:grid-cols-5">
      <div className="flex flex-col gap-2 lg:min-h-0 lg:overflow-hidden lg:col-span-2">
        <div className="plugin-panel flex shrink-0 items-center gap-2">
          <button type="button" className="plugin-btn" disabled={!canGoOlder} onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))} aria-label="Previous period">‹</button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">📅 {periodTitle(selected.bucket)}</p>
          <button type="button" className="plugin-btn" disabled={!canGoNewer} onClick={() => setSelectedIndex((i) => Math.min(series.length - 1, i + 1))} aria-label="Next period">›</button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="shrink-0 grid grid-cols-2 gap-2">
            <StatTile emoji="🍅" value={String(selected.pomodoros)} label="Pomodoros" />
            <StatTile emoji="🎯" value={String(selected.deepWork)} label="Deep work" />
            <StatTile emoji="⏳" value={focusMinutesLabel(selected.focusMinutes)} label="Focus" />
            <StatTile emoji="⏱️" value={formatTimedMovementHeadline(selected.timedSeconds)} label="Move" />
          </div>
          {exercises.length > 0 && (
            <ul className="plugin-panel min-h-0 flex-1 overflow-y-auto space-y-0">
              {exercises.map((agg) => (
                <li key={agg.id} className="plugin-row text-sm">
                  {exerciseEmoji(agg.id)} {formatExerciseRunAggLine(agg)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`plugin-panel lg:col-span-3 lg:min-h-0 ${statsChartShellClass()}`}>
        <StatsProgressChart data={chartData} selectedIndex={selectedIndex} onSelectIndex={setSelectedIndex} />
      </div>
    </div>
  );
};

export default StatsPeriodExplorer;
