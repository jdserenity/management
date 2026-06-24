// src/components/daily/MorningStretchSection.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/context/SessionContext';
import { isTauri } from '@/lib/isTauri';
import {
  isMorningStretchCompletedToday,
  listMorningStretchCatalog,
  resolveMorningStretchExercises,
  type MorningStretchCatalogEntry,
  type MorningStretchRef,
  type MorningStretchRoutine
} from '@/lib/morningStretch/morningStretch';
import { loadMorningStretchRoutine, saveMorningStretchRoutine } from '@/lib/morningStretch/morningStretchDb';
import { formatExerciseAmount } from '@/lib/workoutPlanner';
import { ArrowDown, ArrowUp, Check, Pencil, Play, Plus, Sunrise, Trash2, X } from 'lucide-react';

type ViewMode = 'summary' | 'edit' | 'run';

const refKey = (ref: MorningStretchRef): string => `${ref.kind}:${ref.id}`;

export default function MorningStretchSection() {
  const { workoutCustomizePrefs, workoutLogs, dayRolloverHour, logMorningStretchCompletion } = useSession();
  const [routine, setRoutine] = useState<MorningStretchRoutine | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [saving, setSaving] = useState(false);

  const catalog = useMemo(() => listMorningStretchCatalog(workoutCustomizePrefs), [workoutCustomizePrefs]);
  const catalogByKey = useMemo(() => new Map(catalog.map((row) => [refKey(row.ref), row])), [catalog]);
  const resolvedExercises = useMemo(
    () => (routine ? resolveMorningStretchExercises(routine, workoutCustomizePrefs) : []),
    [routine, workoutCustomizePrefs]
  );
  const doneToday = useMemo(
    () => isMorningStretchCompletedToday(workoutLogs, Date.now(), dayRolloverHour),
    [workoutLogs, dayRolloverHour]
  );

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      setLoadError(null);
      setRoutine(null);
      return;
    }
    try {
      setLoadError(null);
      const next = await loadMorningStretchRoutine(workoutCustomizePrefs);
      setRoutine(next);
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load morning stretch');
    }
  }, [workoutCustomizePrefs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persistRoutine = async (next: MorningStretchRoutine) => {
    setSaving(true);
    try {
      await saveMorningStretchRoutine(next);
      setRoutine(next);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const addRef = (ref: MorningStretchRef) => {
    if (!routine) return;
    if (routine.exerciseRefs.some((r) => refKey(r) === refKey(ref))) return;
    void persistRoutine({ exerciseRefs: [...routine.exerciseRefs, ref] });
  };

  const removeAt = (index: number) => {
    if (!routine) return;
    void persistRoutine({ exerciseRefs: routine.exerciseRefs.filter((_, i) => i !== index) });
  };

  const moveRef = (index: number, dir: -1 | 1) => {
    if (!routine) return;
    const next = [...routine.exerciseRefs];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void persistRoutine({ exerciseRefs: next });
  };

  const labelForRef = (ref: MorningStretchRef): string => catalogByKey.get(refKey(ref))?.label ?? ref.id;

  const handleComplete = () => {
    if (resolvedExercises.length === 0) return;
    logMorningStretchCompletion(resolvedExercises);
    setViewMode('summary');
  };

  if (!isTauri()) {
    return (
      <section aria-label="Morning stretch">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Sunrise className="h-5 w-5 text-amber-500" />
          Morning stretch
        </h2>
        <p className="text-sm text-muted-foreground">
          Run <code className="text-foreground">npm run tauri dev</code> for SQLite and Tauri APIs.
        </p>
      </section>
    );
  }

  if (loadError) return <p className="text-sm text-destructive">Could not load morning stretch: {loadError}</p>;
  if (!routine) return <p className="text-sm text-muted-foreground">Loading morning stretch…</p>;

  const availableToAdd = catalog.filter((row) => !routine.exerciseRefs.some((r) => refKey(r) === refKey(row.ref)));

  return (
    <section aria-label="Morning stretch">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sunrise className="h-5 w-5 text-amber-500" />
              Morning stretch
            </CardTitle>
            {viewMode === 'summary' && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewMode('edit')} aria-label="Edit morning stretch routine">
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                {resolvedExercises.length > 0 && (
                  <Button size="sm" onClick={() => setViewMode('run')} disabled={doneToday}>
                    <Play className="h-4 w-4" />
                    {doneToday ? 'Done today' : 'Start'}
                  </Button>
                )}
              </div>
            )}
            {viewMode !== 'summary' && (
              <Button size="sm" variant="ghost" onClick={() => setViewMode('summary')} aria-label="Close morning stretch editor">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {doneToday && viewMode === 'summary' && (
            <p className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <Check className="h-4 w-4 shrink-0" />
              Completed for today. You can edit the routine anytime; use Do again if you want another log.
            </p>
          )}

          {viewMode === 'summary' && (
            <>
              {routine.exerciseRefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Build a wake-up routine from your enabled exercises. Add moves in Customize workouts first if the pool is empty.
                </p>
              ) : (
                <ol className="space-y-2">
                  {routine.exerciseRefs.map((ref, index) => (
                    <li key={`${refKey(ref)}-${index}`} className="rounded-md border px-3 py-2 text-sm">
                      <span className="font-medium">{labelForRef(ref)}</span>
                    </li>
                  ))}
                </ol>
              )}
              {doneToday && resolvedExercises.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setViewMode('run')}>
                  Do again
                </Button>
              )}
            </>
          )}

          {viewMode === 'edit' && (
            <EditRoutinePanel
              routine={routine}
              availableToAdd={availableToAdd}
              saving={saving}
              labelForRef={labelForRef}
              onAdd={addRef}
              onRemove={removeAt}
              onMove={moveRef}
            />
          )}

          {viewMode === 'run' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Work through each move in order, then complete the routine.</p>
              <ul className="space-y-2">
                {resolvedExercises.map((ex, index) => (
                  <li key={`${ex.id}-${index}`} className="rounded-md border bg-muted/20 px-3 py-2">
                    <p className="text-sm font-medium">{ex.name}</p>
                    <p className="text-xs text-muted-foreground">{formatExerciseAmount(ex)}</p>
                  </li>
                ))}
              </ul>
              <Button onClick={handleComplete}>Complete routine</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

type EditRoutinePanelProps = {
  routine: MorningStretchRoutine;
  availableToAdd: MorningStretchCatalogEntry[];
  saving: boolean;
  labelForRef: (ref: MorningStretchRef) => string;
  onAdd: (ref: MorningStretchRef) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
};

function EditRoutinePanel({ routine, availableToAdd, saving, labelForRef, onAdd, onRemove, onMove }: EditRoutinePanelProps) {
  const [pickKind, setPickKind] = useState<'moves' | 'stretches' | 'custom' | ''>('');
  const filteredAdd = pickKind ? availableToAdd.filter((row) => row.group === pickKind) : availableToAdd;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Only exercises enabled under Customize workouts appear here. Add new moves to the global pool first.
      </p>
      {routine.exerciseRefs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No moves in your routine yet.</p>
      ) : (
        <ol className="space-y-2">
          {routine.exerciseRefs.map((ref, index) => (
            <li key={`${refKey(ref)}-${index}`} className="flex items-center gap-2 rounded-md border px-2 py-2">
              <span className="min-w-0 flex-1 text-sm font-medium">{labelForRef(ref)}</span>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={index === 0 || saving} onClick={() => onMove(index, -1)} aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={index === routine.exerciseRefs.length - 1 || saving} onClick={() => onMove(index, 1)} aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" disabled={saving} onClick={() => onRemove(index)} aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {availableToAdd.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Filter
            <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" value={pickKind} onChange={(e) => setPickKind(e.target.value as typeof pickKind)}>
              <option value="">All</option>
              <option value="moves">Moves</option>
              <option value="stretches">Stretches</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Add exercise
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
              defaultValue=""
              onChange={(e) => {
                const row = filteredAdd.find((r) => refKey(r.ref) === e.target.value);
                if (row) onAdd(row.ref);
                e.target.value = '';
              }}
            >
              <option value="" disabled>Select…</option>
              {filteredAdd.map((row) => (
                <option key={refKey(row.ref)} value={refKey(row.ref)}>{row.label}</option>
              ))}
            </select>
          </label>
          <Plus className="mb-2 h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
      )}
      {availableToAdd.length === 0 && routine.exerciseRefs.length === 0 && (
        <p className="text-sm text-muted-foreground">Enable exercises on the Customize workouts tab first.</p>
      )}
    </div>
  );
}
