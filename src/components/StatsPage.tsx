import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import {
  mergePeriodStats,
  summarizeFocusLogs,
  summarizeWorkoutLogs,
  type PeriodStatsPoint
} from '@/lib/workoutPlanner';

const timedMinutesLabel = (seconds: number) => {
  if (seconds <= 0) return '0m';
  return `${Math.round(seconds / 60)}m`;
};

const focusMinutesLabel = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const periodLine = (point: PeriodStatsPoint) =>
  `🍅 ${point.pomodoros} · 🎯 ${point.deepWork} · ⏳ ${focusMinutesLabel(point.focusMinutes)} · 📊 ${point.reps} reps · ⏱️ ${timedMinutesLabel(point.timedSeconds)} · 🏋️ ${point.workouts}`;

const PeriodBucketList = ({ points }: { points: PeriodStatsPoint[] }) => (
  <div className="space-y-2">
    {points.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
    {points.map((point) => (
      <div key={point.bucket} className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="font-medium">{point.bucket}</span>
        <span className="text-muted-foreground tabular-nums sm:text-right">{periodLine(point)}</span>
      </div>
    ))}
  </div>
);

const StatsPage = () => {
  const { workoutLogs, focusLogs } = useSession();
  const workoutStats = useMemo(() => summarizeWorkoutLogs(workoutLogs), [workoutLogs]);
  const focusStats = useMemo(() => summarizeFocusLogs(focusLogs), [focusLogs]);
  const weekly = useMemo(() => mergePeriodStats(workoutStats.weekly, focusStats.weekly), [workoutStats.weekly, focusStats.weekly]);
  const monthly = useMemo(() => mergePeriodStats(workoutStats.monthly, focusStats.monthly), [workoutStats.monthly, focusStats.monthly]);

  const allTime: PeriodStatsPoint = {
    bucket: 'All time',
    pomodoros: focusStats.totalPomodoros,
    deepWork: focusStats.totalDeepWork,
    focusMinutes: focusStats.totalFocusMinutes,
    reps: workoutStats.totalReps,
    timedSeconds: workoutStats.totalTimedSeconds,
    workouts: workoutStats.totalWorkouts
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            📅 Weekly
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PeriodBucketList points={weekly} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            🗓️ Monthly
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PeriodBucketList points={monthly} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            ♾️ All time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border px-3 py-3 text-sm font-medium tabular-nums">{periodLine(allTime)}</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsPage;
