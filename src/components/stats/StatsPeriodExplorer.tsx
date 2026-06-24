import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  formatExerciseRunAggLine,
  formatTimedMovementHeadline,
  listNonZeroExerciseTotals,
  type PeriodStatsPoint
} from '@/lib/workoutPlanner';
import StatsProgressChart, { toChartRows, type StatsChartRow } from '@/components/stats/StatsProgressChart';

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

const StatTile = ({ emoji, value, label, tone }: { emoji: string; value: string; label: string; tone: string }) => (
  <div className={`rounded-xl px-2.5 py-2 shadow-sm ${tone}`}>
    <p className="text-xl leading-none">{emoji}</p>
    <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{value}</p>
    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
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
    return (
      <p className="rounded-2xl border border-dashed border-violet-300/40 bg-violet-50/50 px-4 py-12 text-center text-violet-700/80 dark:border-violet-500/30 dark:bg-violet-950/20 dark:text-violet-200/80">
        ✨ No activity in this range yet — start a session on Work!
      </p>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-5">
      <div className="flex min-h-0 flex-col gap-2 overflow-hidden lg:col-span-2">
        <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-white shadow-lg shadow-violet-500/25">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white hover:bg-white/20" disabled={!canGoOlder} onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))} aria-label="Previous period">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-bold sm:text-base">📅 {periodTitle(selected.bucket)}</p>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white hover:bg-white/20" disabled={!canGoNewer} onClick={() => setSelectedIndex((i) => Math.min(series.length - 1, i + 1))} aria-label="Next period">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <div className="shrink-0 space-y-2">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">🧠 Focus</p>
              <div className="grid grid-cols-2 gap-1.5">
                <StatTile emoji="🍅" value={String(selected.pomodoros)} label="Pomodoros" tone="bg-rose-100 text-rose-950 dark:bg-rose-950/50 dark:text-rose-100" />
                <StatTile emoji="🎯" value={String(selected.deepWork)} label="Deep work" tone="bg-violet-100 text-violet-950 dark:bg-violet-950/50 dark:text-violet-100" />
                <StatTile emoji="⏳" value={focusMinutesLabel(selected.focusMinutes)} label="Focus time" tone="col-span-2 bg-sky-100 text-sky-950 dark:bg-sky-950/50 dark:text-sky-100" />
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300">💪 Movement</p>
              <div className="grid grid-cols-2 gap-1.5">
                <StatTile emoji="⏱️" value={formatTimedMovementHeadline(selected.timedSeconds)} label="Move time" tone="bg-emerald-100 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100" />
                <StatTile emoji="🏋️" value={String(selected.workouts)} label="Workouts" tone="bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100" />
              </div>
            </div>
          </div>

          {exercises.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <p className="mb-1 shrink-0 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">📝 By exercise</p>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {exercises.map((agg) => (
                  <div key={agg.id} className="flex items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-medium shadow-sm dark:bg-slate-800/80">
                    <span className="text-lg leading-none">{exerciseEmoji(agg.id)}</span>
                    <span className="min-w-0 truncate tabular-nums">{formatExerciseRunAggLine(agg)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 overflow-visible lg:col-span-3">
        <StatsProgressChart data={chartData} selectedIndex={selectedIndex} />
      </div>
    </div>
  );
};

export default StatsPeriodExplorer;
