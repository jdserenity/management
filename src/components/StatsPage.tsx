import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import { countTodayDeepWorkSessions, summarizeWorkoutLogs } from '@/lib/workoutPlanner';

const timedMinutesLabel = (seconds: number) => {
  if (seconds <= 0) return '0m';
  return `${Math.round(seconds / 60)}m`;
};

const StatsPage = () => {
  const { workoutLogs, focusLogs } = useSession();
  const cumulativeWorkoutStats = useMemo(() => summarizeWorkoutLogs(workoutLogs), [workoutLogs]);
  const deepWorkToday = useMemo(() => countTodayDeepWorkSessions(focusLogs), [focusLogs]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">📊 Total reps</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{cumulativeWorkoutStats.totalReps}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">⏱️ Timed (all time)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{timedMinutesLabel(cumulativeWorkoutStats.totalTimedSeconds)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">🏋️ Total workouts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{cumulativeWorkoutStats.totalWorkouts}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">📅 Reps (7d)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{cumulativeWorkoutStats.last7DaysReps}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">⏱️ Timed (7d)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{timedMinutesLabel(cumulativeWorkoutStats.last7DaysTimedSeconds)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">🎯 Deep work today</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{deepWorkToday}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            📈 Weekly & monthly
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="font-medium mb-2">Weekly</p>
            <div className="space-y-2">
              {cumulativeWorkoutStats.weekly.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              {cumulativeWorkoutStats.weekly.map((point) => (
                <div key={point.bucket} className="flex items-center justify-between text-sm rounded-md border px-3 py-2 gap-2">
                  <span>{point.bucket}</span>
                  <span className="text-right tabular-nums">{point.reps} reps · {timedMinutesLabel(point.timedSeconds)} · {point.workouts} workouts</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium mb-2">Monthly</p>
            <div className="space-y-2">
              {cumulativeWorkoutStats.monthly.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
              {cumulativeWorkoutStats.monthly.map((point) => (
                <div key={point.bucket} className="flex items-center justify-between text-sm rounded-md border px-3 py-2 gap-2">
                  <span>{point.bucket}</span>
                  <span className="text-right tabular-nums">{point.reps} reps · {timedMinutesLabel(point.timedSeconds)} · {point.workouts} workouts</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsPage;
