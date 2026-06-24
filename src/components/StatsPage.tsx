import { useCallback, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatsPeriodExplorer from '@/components/stats/StatsPeriodExplorer';
import { useSession } from '@/context/SessionContext';
import { cn } from '@/lib/utils';
import {
  fillPeriodSeries,
  formatExerciseRunAggLine,
  formatMonthBucketLabel,
  formatMonthChartLabel,
  formatTimedMovementHeadline,
  formatWeekBucketLabel,
  formatWeekChartLabel,
  listNonZeroExerciseTotals,
  mergePeriodStats,
  recentMonthBucketKeys,
  recentWeekBucketKeys,
  summarizeExerciseTotalsAllTime,
  summarizeExerciseTotalsForMonthBucket,
  summarizeExerciseTotalsForWeekBucket,
  summarizeFocusLogs,
  summarizeWorkoutLogs,
  type PeriodStatsPoint
} from '@/lib/workoutPlanner';

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

const AllTimeStat = ({ emoji, value, label, className }: { emoji: string; value: string; label: string; className: string }) => (
  <div className={`rounded-3xl px-5 py-6 text-center shadow-md ${className}`}>
    <p className="text-4xl">{emoji}</p>
    <p className="mt-3 text-4xl font-black tabular-nums tracking-tight sm:text-5xl">{value}</p>
    <p className="mt-2 text-sm font-bold uppercase tracking-wider opacity-90">{label}</p>
  </div>
);

const AllTimeView = ({ point, exercises }: { point: PeriodStatsPoint; exercises: ReturnType<typeof listNonZeroExerciseTotals> }) => {
  const empty = !point.pomodoros && !point.deepWork && !point.focusMinutes && !point.timedSeconds && !point.workouts && exercises.length === 0;
  if (empty) {
    return (
      <p className="rounded-3xl border-2 border-dashed border-indigo-300/50 bg-white/60 px-6 py-16 text-center text-lg text-indigo-800/70 dark:border-indigo-500/40 dark:bg-slate-900/40 dark:text-indigo-200/80">
        🌱 Your all-time stats will show up here once you log some work!
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">🧠 Focus — all time</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AllTimeStat emoji="🍅" value={String(point.pomodoros)} label="Pomodoros" className="bg-gradient-to-br from-rose-400 to-orange-500 text-white" />
          <AllTimeStat emoji="🎯" value={String(point.deepWork)} label="Deep work" className="bg-gradient-to-br from-violet-500 to-purple-600 text-white" />
          <AllTimeStat emoji="⏳" value={focusMinutesLabel(point.focusMinutes)} label="Focus time" className="bg-gradient-to-br from-sky-400 to-blue-600 text-white" />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">💪 Movement — all time</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AllTimeStat emoji="⏱️" value={formatTimedMovementHeadline(point.timedSeconds)} label="Move time" className="bg-gradient-to-br from-emerald-400 to-teal-600 text-white" />
          <AllTimeStat emoji="🏋️" value={String(point.workouts)} label="Workouts logged" className="bg-gradient-to-br from-amber-400 to-orange-500 text-white" />
        </div>
      </div>

      {exercises.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">📝 Every exercise you&apos;ve done</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {exercises.map((agg) => (
              <div key={agg.id} className="flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 text-base font-semibold shadow-sm dark:bg-slate-800/90">
                <span className="text-2xl">{exerciseEmoji(agg.id)}</span>
                <span className="tabular-nums">{formatExerciseRunAggLine(agg)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatsPage = () => {
  const { workoutLogs, focusLogs } = useSession();
  const workoutStats = useMemo(() => summarizeWorkoutLogs(workoutLogs), [workoutLogs]);
  const focusStats = useMemo(() => summarizeFocusLogs(focusLogs), [focusLogs]);
  const weeklyMerged = useMemo(() => mergePeriodStats(workoutStats.weekly, focusStats.weekly), [workoutStats.weekly, focusStats.weekly]);
  const monthlyMerged = useMemo(() => mergePeriodStats(workoutStats.monthly, focusStats.monthly), [workoutStats.monthly, focusStats.monthly]);

  const weeklySeries = useMemo(() => fillPeriodSeries(recentWeekBucketKeys(), weeklyMerged), [weeklyMerged]);
  const monthlySeries = useMemo(() => fillPeriodSeries(recentMonthBucketKeys(), monthlyMerged), [monthlyMerged]);

  const weeklyExercises = useCallback((bucket: string) => listNonZeroExerciseTotals(summarizeExerciseTotalsForWeekBucket(workoutLogs, bucket)), [workoutLogs]);
  const monthlyExercises = useCallback((bucket: string) => listNonZeroExerciseTotals(summarizeExerciseTotalsForMonthBucket(workoutLogs, bucket)), [workoutLogs]);

  const allTime: PeriodStatsPoint = {
    bucket: 'all',
    pomodoros: focusStats.totalPomodoros,
    deepWork: focusStats.totalDeepWork,
    focusMinutes: focusStats.totalFocusMinutes,
    reps: workoutStats.totalReps,
    timedSeconds: workoutStats.totalTimedSeconds,
    workouts: workoutStats.totalWorkouts
  };
  const allTimeExercises = useMemo(() => listNonZeroExerciseTotals(summarizeExerciseTotalsAllTime(workoutLogs)), [workoutLogs]);
  const [tab, setTab] = useState('all');
  const periodTab = tab === 'weekly' || tab === 'monthly';

  return (
    <div className={cn('space-y-4 rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-violet-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 sm:p-5', periodTab && 'flex h-[calc(100dvh-7.25rem)] flex-col overflow-hidden')}>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-3xl">📊</span>
        <h2 className="bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-2xl font-black tracking-tight text-transparent dark:from-violet-300 dark:to-indigo-300">Stats</h2>
      </div>

      <Tabs value={tab} onValueChange={setTab} className={cn('gap-4', periodTab && 'flex min-h-0 flex-1 flex-col overflow-hidden')}>
        <TabsList className="grid h-12 w-full shrink-0 grid-cols-3 rounded-2xl bg-white/70 p-1 shadow-sm dark:bg-slate-800/70">
          <TabsTrigger value="all" className="rounded-xl text-sm font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">♾️ All time</TabsTrigger>
          <TabsTrigger value="monthly" className="rounded-xl text-sm font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">🗓️ Monthly</TabsTrigger>
          <TabsTrigger value="weekly" className="rounded-xl text-sm font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">📅 Weekly</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <AllTimeView point={allTime} exercises={allTimeExercises} />
        </TabsContent>

        <TabsContent value="monthly" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <StatsPeriodExplorer series={monthlySeries} periodTitle={formatMonthBucketLabel} chartLabel={formatMonthChartLabel} exercisesForBucket={monthlyExercises} />
        </TabsContent>

        <TabsContent value="weekly" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <StatsPeriodExplorer series={weeklySeries} periodTitle={formatWeekBucketLabel} chartLabel={formatWeekChartLabel} exercisesForBucket={weeklyExercises} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StatsPage;
