// src/components/daily/MovementSnackSection.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';
import { useSession } from '@/context/SessionContext';
import {
  DASHBOARD_TODAY_STRETCH_ROWS,
  formatExerciseAmount,
  formatExerciseRunAggLine,
  formatTimedSecondsTotal,
  listNonZeroExerciseTotals
} from '@/lib/workoutPlanner';

export default function MovementSnackSection() {
  const {
    movementSnackPrefs,
    todayMovementSnacks,
    todayExerciseTotals,
    todayStretchTotals,
    logMovementSnackCompletion
  } = useSession();

  const todayExercises = useMemo(() => listNonZeroExerciseTotals(todayExerciseTotals), [todayExerciseTotals]);

  const goal = movementSnackPrefs.dailyGoal;
  const done = todayMovementSnacks;
  const progressPct = Math.min(100, Math.round((done / goal) * 100));
  const complete = done >= goal;

  return (
    <section aria-label="Movement Snacks">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span role="img" aria-label="popcorn">🍿</span>
            Movement Snacks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Progress value={progressPct} className="flex-1" />
            <span className="text-sm font-medium tabular-nums shrink-0">
              {complete ? '✅ ' : ''}{done}/{goal} done today
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Hard version */}
            <div className="flex flex-col rounded-xl border bg-gradient-to-br from-emerald-500/8 via-background to-emerald-400/6 p-4 shadow-sm ring-1 ring-emerald-500/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">💪 Hard version</p>
                <span className="text-[10px] text-muted-foreground">Ideal</span>
              </div>
              <ul className="space-y-1 mb-3 flex-1">
                {movementSnackPrefs.hardExercises.map((ex) => (
                  <li key={ex.id} className="text-sm text-muted-foreground leading-snug">
                    {ex.name} · <span className="tabular-nums">{formatExerciseAmount(ex)}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                className="w-full"
                onClick={() => logMovementSnackCompletion(false)}
              >
                Log hard snack
              </Button>
            </div>

            {/* Easy version */}
            <div className="flex flex-col rounded-xl border bg-gradient-to-br from-amber-500/8 via-background to-amber-400/6 p-4 shadow-sm ring-1 ring-amber-500/10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">🌱 Easy version</p>
                <span className="text-[10px] text-muted-foreground">Fallback</span>
              </div>
              <ul className="space-y-1 mb-3 flex-1">
                {movementSnackPrefs.easyExercises.map((ex) => (
                  <li key={ex.id} className="text-sm text-muted-foreground leading-snug">
                    {ex.name} · <span className="tabular-nums">{formatExerciseAmount(ex)}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => logMovementSnackCompletion(true)}
              >
                Log easy snack
              </Button>
            </div>
          </div>

          {(todayExercises.length > 0 || todayStretchTotals.upperBodySeconds > 0 || todayStretchTotals.lowerBodySeconds > 0) && (
            <div className="space-y-2 rounded-lg border bg-muted/15 px-3 py-3">
              <p className="text-sm font-semibold">Today&apos;s movement</p>
              {todayExercises.map((agg) => (
                <div key={agg.id} className="rounded-md border bg-background px-3 py-2 text-sm">
                  <span className="font-medium leading-snug">{formatExerciseRunAggLine(agg)}</span>
                </div>
              ))}
              {DASHBOARD_TODAY_STRETCH_ROWS.map((row) => {
                const seconds = row.region === 'upper' ? todayStretchTotals.upperBodySeconds : todayStretchTotals.lowerBodySeconds;
                if (seconds <= 0) return null;
                return (
                  <div key={row.region} className="rounded-md border bg-background px-3 py-2 text-sm">
                    <span className="font-medium leading-snug">{row.label}: {formatTimedSecondsTotal(seconds)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}