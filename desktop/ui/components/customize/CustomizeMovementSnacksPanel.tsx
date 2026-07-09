// src/components/customize/CustomizeMovementSnacksPanel.tsx

import { useCallback, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import type { ExerciseDefinition, ExerciseUnit } from '@/lib/workoutPlanner';

const UNIT_OPTIONS: { value: ExerciseUnit; label: string }[] = [
  { value: 'reps', label: 'reps' },
  { value: 'seconds', label: 'sec' },
  { value: 'minutes', label: 'min' }
];

const createExerciseId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}`;
};

type VersionKind = 'hard' | 'easy';

export default function CustomizeMovementSnacksPanel() {
  const { movementSnackPrefs, updateMovementSnackPrefs } = useSession();

  const [dailyGoal, setDailyGoal] = useState(movementSnackPrefs.dailyGoal);
  const [addingTo, setAddingTo] = useState<VersionKind | null>(null);
  const [addName, setAddName] = useState('');
  const [addAmount, setAddAmount] = useState(10);
  const [addUnit, setAddUnit] = useState<ExerciseUnit>('reps');

  const hardExercises = useMemo(() => movementSnackPrefs.hardExercises, [movementSnackPrefs.hardExercises]);
  const easyExercises = useMemo(() => movementSnackPrefs.easyExercises, [movementSnackPrefs.easyExercises]);

  const commitGoal = useCallback(() => {
    const goal = Math.max(1, Math.round(dailyGoal));
    setDailyGoal(goal);
    updateMovementSnackPrefs({ dailyGoal: goal });
  }, [dailyGoal, updateMovementSnackPrefs]);

  const updateExercise = useCallback(
    (kind: VersionKind, index: number, field: 'amount' | 'unit', value: number | ExerciseUnit) => {
      const list = kind === 'hard' ? [...hardExercises] : [...easyExercises];
      if (index < 0 || index >= list.length) return;
      const ex = { ...list[index] };
      if (field === 'amount') ex.amount = Math.max(0, Math.round(value as number));
      else ex.unit = value as ExerciseUnit;
      list[index] = ex;
      updateMovementSnackPrefs(kind === 'hard' ? { hardExercises: list } : { easyExercises: list });
    },
    [hardExercises, easyExercises, updateMovementSnackPrefs]
  );

  const removeExercise = useCallback(
    (kind: VersionKind, index: number) => {
      const list = kind === 'hard' ? [...hardExercises] : [...easyExercises];
      if (index < 0 || index >= list.length || list.length <= 1) return;
      list.splice(index, 1);
      updateMovementSnackPrefs(kind === 'hard' ? { hardExercises: list } : { easyExercises: list });
    },
    [hardExercises, easyExercises, updateMovementSnackPrefs]
  );

  const addExercise = useCallback(() => {
    const name = addName.trim();
    if (!name || !addingTo) return;
    const ex: ExerciseDefinition = {
      id: createExerciseId('snack'),
      name,
      amount: Math.max(0, Math.round(addAmount)),
      unit: addUnit,
    };
    const list = addingTo === 'hard' ? [...hardExercises, ex] : [...easyExercises, ex];
    updateMovementSnackPrefs(addingTo === 'hard' ? { hardExercises: list } : { easyExercises: list });
    setAddName('');
    setAddAmount(10);
    setAddUnit('reps');
    setAddingTo(null);
  }, [addName, addAmount, addUnit, addingTo, hardExercises, easyExercises, updateMovementSnackPrefs]);

  const renderExerciseList = (kind: VersionKind, exercises: ExerciseDefinition[]) => (
    <div className="space-y-2">
      {exercises.length === 0 ? (
        <p className="text-xs text-muted-foreground">No exercises yet.</p>
      ) : (
        <ul className="space-y-2">
          {exercises.map((ex, index) => (
            <li key={ex.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-2">
              <span className="text-sm font-medium min-w-0 flex-1">{ex.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold tabular-nums"
                    value={ex.amount}
                    onChange={(e) => updateExercise(kind, index, 'amount', Number(e.target.value))}
                  />
                  <select
                    className="rounded-md border border-input bg-background px-1 py-1 text-xs"
                    value={ex.unit}
                    onChange={(e) => updateExercise(kind, index, 'unit', e.target.value as ExerciseUnit)}
                  >
                    {UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={exercises.length <= 1}
                  aria-label={`Remove ${ex.name}`}
                  onClick={() => removeExercise(kind, index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Movement bursts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Set your daily movement burst goal and customise the exercises for the hard and easy versions.
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Daily goal */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Daily burst goal
            <input
              type="number"
              min={1}
              className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-semibold tabular-nums"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              onBlur={commitGoal}
            />
          </label>
          <Button type="button" size="sm" variant="outline" onClick={commitGoal}>Update</Button>
        </div>

        {/* Hard version */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">💪 Hard version</p>
            <span className="text-xs text-muted-foreground">Ideal burst</span>
          </div>
          {renderExerciseList('hard', hardExercises)}
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() => setAddingTo(addingTo === 'hard' ? null : 'hard')}
            >
              <Plus className="h-4 w-4" />
              Add exercise
            </Button>
            {addingTo === 'hard' && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Name
                  <input
                    className="min-w-[8rem] rounded-md border border-input bg-background px-2 py-1 text-sm"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Push-ups"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Amount
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold tabular-nums"
                    value={addAmount}
                    onChange={(e) => setAddAmount(Number(e.target.value))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Unit
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value as ExerciseUnit)}
                  >
                    {UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <Button type="button" size="sm" onClick={addExercise}>Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddingTo(null)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>

        {/* Easy version */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold">🌱 Easy version</p>
            <span className="text-xs text-muted-foreground">Fallback burst</span>
          </div>
          {renderExerciseList('easy', easyExercises)}
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() => setAddingTo(addingTo === 'easy' ? null : 'easy')}
            >
              <Plus className="h-4 w-4" />
              Add exercise
            </Button>
            {addingTo === 'easy' && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Name
                  <input
                    className="min-w-[8rem] rounded-md border border-input bg-background px-2 py-1 text-sm"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Push-ups"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Amount
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold tabular-nums"
                    value={addAmount}
                    onChange={(e) => setAddAmount(Number(e.target.value))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Unit
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value as ExerciseUnit)}
                  >
                    {UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <Button type="button" size="sm" onClick={addExercise}>Add</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddingTo(null)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}