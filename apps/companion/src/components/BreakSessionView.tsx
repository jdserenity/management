import { Clock, Dumbbell } from 'lucide-react';
import { formatClock, formatExerciseAmount, sessionTimerLabel } from '@mgmt/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCompanionSession } from '../context/CompanionSessionContext';

export const BreakSessionView = () => {
  const { activeFlow, remainingSeconds, phase, syncStatus, isLeader, showExercisePanel, completeWorkout } = useCompanionSession();
  const flow = activeFlow?.flow ?? null;
  const exercises = flow?.activeWorkout?.exercises ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Companion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" aria-live="polite">
        <div className="rounded-xl border bg-muted/20 p-4 shadow-inner">
          <p className="text-xl font-semibold">
            {flow
              ? sessionTimerLabel(phase, flow.activeSessionType, flow.breakVariant, flow.longBreakStage)
              : sessionTimerLabel('idle', null, null, null)}
          </p>
          <p className="text-4xl font-bold mt-2 tabular-nums tracking-tight">
            {phase === 'idle' ? '--:--' : formatClock(remainingSeconds)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sync: {syncStatus}
            {isLeader ? ' · leading' : ' · watching'}
          </p>
        </div>

        {showExercisePanel ? (
          <div className="rounded-xl border bg-teal-500/10 p-4 shadow-inner ring-1 ring-border/60 space-y-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4" />
              <p className="font-semibold">{flow?.activeWorkout?.name}</p>
            </div>
            <ul className="space-y-2">
              {exercises.map((exercise, index) => (
                <li
                  key={`${exercise.id}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2 text-sm"
                >
                  <span>{exercise.name}</span>
                  <span className="text-muted-foreground">{formatExerciseAmount(exercise)}</span>
                </li>
              ))}
            </ul>
            {isLeader && !flow?.workoutLogged ? (
              <Button type="button" className="w-full" onClick={completeWorkout}>
                Complete workout
              </Button>
            ) : null}
          </div>
        ) : phase === 'focus' ? (
          <p className="text-sm text-muted-foreground">Focus session in progress on your primary device.</p>
        ) : (
          <p className="text-sm text-muted-foreground">No active session yet. Start one on desktop.</p>
        )}
      </CardContent>
    </Card>
  );
};
