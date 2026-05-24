import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TimerReset } from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import { PREDEFINED_WORKOUTS, STRETCH_MOBILITY_CATALOG_LINES, formatExerciseAmount } from '@/lib/workoutPlanner';

const CustomizeWorkoutPage = () => {
  const { allowedWorkoutIds, handleAllowedWorkoutToggle } = useSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TimerReset className="h-5 w-5 text-violet-600" />
          Customize workouts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Exercise breaks build a random ~2–3 minute circuit from the moves you enable (repeats allowed).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {PREDEFINED_WORKOUTS.map((workout) => {
          const enabled = allowedWorkoutIds.includes(workout.id);
          const isOnlyEnabledWorkout = enabled && allowedWorkoutIds.length === 1;
          return (
            <div key={workout.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{workout.name}</p>
                {workout.id === 'stretch-mobility' ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      15s holds · mixed into break circuits with your other moves when enabled.
                    </p>
                    <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                      {STRETCH_MOBILITY_CATALOG_LINES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {workout.exercises.map((ex) => formatExerciseAmount(ex)).join(' · ')}
                  </p>
                )}
              </div>
              <Switch
                checked={enabled}
                disabled={isOnlyEnabledWorkout}
                onCheckedChange={(checked) => handleAllowedWorkoutToggle(workout.id, checked)}
                className="shrink-0"
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CustomizeWorkoutPage;
