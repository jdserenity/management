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

const AllTimeStat = ({ emoji, value, label }: { emoji: string; value: string; label: string }) => (
  <div className="plugin-stat-block text-center">
    <p className="text-xl">{emoji}</p>
    <p className="plugin-counts mt-1">{value}</p>
    <p className="plugin-muted mt-1 text-xs font-semibold uppercase tracking-wide">{label}</p>
  </div>
);

const AllTimeView = ({ point, exercises }: { point: PeriodStatsPoint; exercises: ReturnType<typeof listNonZeroExerciseTotals> }) => {
  const empty = !point.pomodoros && !point.deepWork && !point.focusMinutes && !point.timedSeconds && !point.workouts && exercises.length === 0;
  if (empty) {
    return <p className="plugin-panel-flat border-dashed plugin-empty py-12 text-center">🌱 Your all-time stats will show up here once you log some work!</p>;
  }

  return (
    <div className="space-y-4">
      <section className="plugin-panel">
        <h3 className="plugin-panel-title">🧠 Focus — all time</h3>
        <div className="grid grid-cols-3 gap-2">
          <AllTimeStat emoji="🍅" value={String(point.pomodoros)} label="Pomodoros" />
          <AllTimeStat emoji="🎯" value={String(point.deepWork)} label="Deep work" />
          <AllTimeStat emoji="⏳" value={focusMinutesLabel(point.focusMinutes)} label="Focus time" />
        </div>
      </section>

      <section className="plugin-panel">
        <h3 className="plugin-panel-title">💪 Movement — all time</h3>
        <div className="grid grid-cols-2 gap-2">
          <AllTimeStat emoji="⏱️" value={formatTimedMovementHeadline(point.timedSeconds)} label="Move time" />
          <AllTimeStat emoji="🏋️" value={String(point.workouts)} label="Workouts logged" />
        </div>
      </section>

      {exercises.length > 0 && (
        <section className="plugin-panel">
          <h3 className="plugin-panel-title">📝 Every exercise</h3>
          <ul className="space-y-0">
            {exercises.map((agg) => (
              <li key={agg.id} className="plugin-row text-sm font-medium">
                <span>{exerciseEmoji(agg.id)} {formatExerciseRunAggLine(agg)}</span>
              </li>
            ))}
          </ul>
        </section>
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
    <div className={cn('plugin-page', periodTab && 'lg:flex lg:h-[calc(100dvh-7.25rem)] lg:flex-col lg:overflow-hidden lg:max-w-none')}>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-2xl">📊</span>
        <h2 className="plugin-section-title mb-0">Stats</h2>
      </div>

      <Tabs value={tab} onValueChange={setTab} className={cn('gap-3', periodTab && 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden')}>
        <TabsList className="grid w-full shrink-0 grid-cols-3">
          <TabsTrigger value="all">♾️ All time</TabsTrigger>
          <TabsTrigger value="monthly">🗓️ Monthly</TabsTrigger>
          <TabsTrigger value="weekly">📅 Weekly</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <AllTimeView point={allTime} exercises={allTimeExercises} />
        </TabsContent>

        <TabsContent value="monthly" className="mt-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
          <StatsPeriodExplorer series={monthlySeries} periodTitle={formatMonthBucketLabel} chartLabel={formatMonthChartLabel} exercisesForBucket={monthlyExercises} />
        </TabsContent>

        <TabsContent value="weekly" className="mt-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden">
          <StatsPeriodExplorer series={weeklySeries} periodTitle={formatWeekBucketLabel} chartLabel={formatWeekChartLabel} exercisesForBucket={weeklyExercises} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StatsPage;
