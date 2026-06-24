import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Brain, Dumbbell } from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import {
  SESSION_COUNT_MIN_RATIO,
  formatExerciseRunAggLine,
  formatMonthBucketLabel,
  formatTimedSecondsTotal,
  formatWeekBucketLabel,
  listNonZeroExerciseTotals,
  mergePeriodStats,
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

const StatHeadline = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-xl border bg-muted/30 px-4 py-5 text-center">
    <p className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">{value}</p>
    <p className="mt-1.5 text-sm font-medium text-muted-foreground">{label}</p>
  </div>
);

const FocusHeadlines = ({ point }: { point: PeriodStatsPoint }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-sm font-semibold text-violet-700 dark:text-violet-400">
      <Brain className="h-4 w-4" />
      Focus
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatHeadline value={String(point.pomodoros)} label="Pomodoros completed" />
      <StatHeadline value={String(point.deepWork)} label="Deep work sessions" />
      <StatHeadline value={focusMinutesLabel(point.focusMinutes)} label="Focus time credited" />
    </div>
    <p className="text-xs text-muted-foreground">
      Sessions count when {Math.round(SESSION_COUNT_MIN_RATIO * 100)}% or more complete. Focus time includes partial credit.
    </p>
  </div>
);

const MovementHeadlines = ({ point, exercises }: { point: PeriodStatsPoint; exercises: ReturnType<typeof listNonZeroExerciseTotals> }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
      <Dumbbell className="h-4 w-4" />
      Movement
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatHeadline value={String(point.reps)} label="Total reps" />
      <StatHeadline value={formatTimedSecondsTotal(point.timedSeconds)} label="Timed movement" />
      <StatHeadline value={String(point.workouts)} label="Workouts logged" />
    </div>
    {exercises.length > 0 && (
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">By exercise</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {exercises.map((agg) => (
            <div key={agg.id} className="rounded-lg border px-4 py-3 text-base font-medium tabular-nums">
              {formatExerciseRunAggLine(agg)}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const PeriodSection = ({
  title,
  point,
  exercises
}: {
  title: string;
  point: PeriodStatsPoint;
  exercises: ReturnType<typeof listNonZeroExerciseTotals>;
}) => {
  const hasFocus = point.pomodoros > 0 || point.deepWork > 0 || point.focusMinutes > 0;
  const hasMovement = point.reps > 0 || point.timedSeconds > 0 || point.workouts > 0 || exercises.length > 0;
  if (!hasFocus && !hasMovement) return null;
  return (
    <section className="space-y-6">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {hasFocus && <FocusHeadlines point={point} />}
      {hasMovement && <MovementHeadlines point={point} exercises={exercises} />}
    </section>
  );
};

const StatsPage = () => {
  const { workoutLogs, focusLogs } = useSession();
  const workoutStats = useMemo(() => summarizeWorkoutLogs(workoutLogs), [workoutLogs]);
  const focusStats = useMemo(() => summarizeFocusLogs(focusLogs), [focusLogs]);
  const weekly = useMemo(() => mergePeriodStats(workoutStats.weekly, focusStats.weekly), [workoutStats.weekly, focusStats.weekly]);
  const monthly = useMemo(() => mergePeriodStats(workoutStats.monthly, focusStats.monthly), [workoutStats.monthly, focusStats.monthly]);

  const weeklySections = useMemo(
    () =>
      [...weekly]
        .reverse()
        .map((point) => ({
          point,
          title: formatWeekBucketLabel(point.bucket),
          exercises: listNonZeroExerciseTotals(summarizeExerciseTotalsForWeekBucket(workoutLogs, point.bucket))
        })),
    [weekly, workoutLogs]
  );

  const monthlySections = useMemo(
    () =>
      [...monthly]
        .reverse()
        .map((point) => ({
          point,
          title: formatMonthBucketLabel(point.bucket),
          exercises: listNonZeroExerciseTotals(summarizeExerciseTotalsForMonthBucket(workoutLogs, point.bucket))
        })),
    [monthly, workoutLogs]
  );

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

  const emptyState = (
    <p className="rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground">
      No activity recorded for this period yet.
    </p>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-indigo-600" />
        <h2 className="text-xl font-semibold tracking-tight">Stats</h2>
      </div>

      <Tabs defaultValue="weekly" className="gap-4">
        <TabsList className="grid h-11 w-full grid-cols-3">
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="all">All time</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-8">
          {weeklySections.length === 0 && emptyState}
          {weeklySections.map(({ title, point, exercises }) => (
            <Card key={point.bucket}>
              <CardContent className="pt-6">
                <PeriodSection title={title} point={point} exercises={exercises} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-8">
          {monthlySections.length === 0 && emptyState}
          {monthlySections.map(({ title, point, exercises }) => (
            <Card key={point.bucket}>
              <CardContent className="pt-6">
                <PeriodSection title={title} point={point} exercises={exercises} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Everything recorded</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <PeriodSection title="All time" point={allTime} exercises={allTimeExercises} />
              {!allTime.pomodoros && !allTime.deepWork && !allTime.focusMinutes && !allTime.reps && !allTime.timedSeconds && !allTime.workouts && allTimeExercises.length === 0 && emptyState}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StatsPage;
