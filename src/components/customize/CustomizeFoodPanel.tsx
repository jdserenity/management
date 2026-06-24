import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatChipMacros } from '@/lib/tdee/totals';
import { mealIdFromName } from '@/lib/tdee/meals';
import type { TdeeFile, TdeeMealDef } from '@/lib/tdee/types';
import {
  loadTdeeFile,
  removeTdeeRegular,
  removeTdeeStaple,
  updateTdeeTargets,
  upsertTdeeRegular,
  upsertTdeeStaple
} from '@/lib/tdeeDb';
import { isTauri } from '@/lib/isTauri';

type MealDraft = { name: string; calories: string; protein: string };

const emptyDraft = (): MealDraft => ({ name: '', calories: '', protein: '' });

const MealEditor = ({
  title,
  draft,
  editingId,
  onDraftChange,
  onSave,
  onCancel
}: {
  title: string;
  draft: MealDraft;
  editingId: string | null;
  onDraftChange: (patch: Partial<MealDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-3">
    <p className="text-sm font-semibold">{title}</p>
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Name</span>
        <input className="rounded-md border border-input bg-background px-2 py-1 text-sm" value={draft.name} onChange={(e) => onDraftChange({ name: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Calories</span>
        <input type="number" min={1} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={draft.calories} onChange={(e) => onDraftChange({ calories: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Protein (g)</span>
        <input type="number" min={0} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={draft.protein} onChange={(e) => onDraftChange({ protein: e.target.value })} />
      </label>
      <Button type="button" size="sm" onClick={onSave}>{editingId ? 'Save' : 'Add'}</Button>
      {editingId ? <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button> : null}
    </div>
  </div>
);

const MealList = ({
  meals,
  onEdit,
  onRemove
}: {
  meals: TdeeMealDef[];
  onEdit: (meal: TdeeMealDef) => void;
  onRemove: (id: string) => void;
}) => {
  if (meals.length === 0) return <p className="text-xs text-muted-foreground">None yet.</p>;
  return (
    <ul className="space-y-2">
      {meals.map((meal) => (
        <li key={meal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
          <div className="min-w-0">
            <p className="font-medium">{meal.name}</p>
            <p className="text-xs text-muted-foreground">{formatChipMacros(meal.calories, meal.protein)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={() => onEdit(meal)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(meal.id)}>Remove</Button>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default function CustomizeFoodPanel() {
  const [file, setFile] = useState<TdeeFile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tdeeDraft, setTdeeDraft] = useState('');
  const [proteinDraft, setProteinDraft] = useState('');
  const [stapleDraft, setStapleDraft] = useState<MealDraft>(emptyDraft);
  const [stapleEditId, setStapleEditId] = useState<string | null>(null);
  const [regularDraft, setRegularDraft] = useState<MealDraft>(emptyDraft);
  const [regularEditId, setRegularEditId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isTauri()) { setLoadError(null); setFile(null); return; }
    try {
      setLoadError(null);
      const next = await loadTdeeFile();
      setFile(next);
      setTdeeDraft(String(next.tdee || ''));
      setProteinDraft(String(next.protein || ''));
    } catch (e) {
      console.error(e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load nutrition data');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const saveMeal = async (
    kind: 'staple' | 'regular',
    draft: MealDraft,
    editId: string | null,
    meals: TdeeMealDef[],
    upsert: (f: TdeeFile, meal: TdeeMealDef, isNew: boolean) => Promise<TdeeFile>
  ) => {
    if (!file) return;
    const name = draft.name.trim();
    const calories = Math.round(Number(draft.calories));
    const protein = Math.max(0, Math.round(Number(draft.protein) || 0));
    if (!name || !calories || calories <= 0) return;
    const isNew = !editId;
    const id = editId || mealIdFromName(name, meals);
    setFile(await upsert(file, { id, name, calories, protein }, isNew));
    if (kind === 'staple') { setStapleDraft(emptyDraft()); setStapleEditId(null); }
    else { setRegularDraft(emptyDraft()); setRegularEditId(null); }
  };

  if (!isTauri()) {
    return <p className="text-sm text-muted-foreground">Run <code>npm run tauri dev</code> to edit food items.</p>;
  }
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!file) return <p className="text-sm text-muted-foreground">Loading food…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Targets</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">TDEE (kcal)</span>
              <input type="number" min={0} className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={tdeeDraft} onChange={(e) => setTdeeDraft(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Protein (g)</span>
              <input type="number" min={0} className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={proteinDraft} onChange={(e) => setProteinDraft(e.target.value)} />
            </label>
            <Button type="button" size="sm" onClick={() => void updateTdeeTargets(file, Number(tdeeDraft) || 0, Number(proteinDraft) || 0).then(setFile)}>Save targets</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Staples</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">One-tap items on the Daily food chain until logged each day.</p>
          <MealList meals={file.staples} onEdit={(meal) => { setStapleEditId(meal.id); setStapleDraft({ name: meal.name, calories: String(meal.calories), protein: String(meal.protein) }); }} onRemove={(id) => void removeTdeeStaple(file, id).then(setFile)} />
          <MealEditor title={stapleEditId ? 'Edit staple' : 'Add staple'} draft={stapleDraft} editingId={stapleEditId} onDraftChange={(p) => setStapleDraft((d) => ({ ...d, ...p }))} onSave={() => void saveMeal('staple', stapleDraft, stapleEditId, file.staples, upsertTdeeStaple)} onCancel={() => { setStapleDraft(emptyDraft()); setStapleEditId(null); }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Regulars</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Reusable meals with default portions; log them from the + menu on Daily.</p>
          <MealList meals={file.regulars} onEdit={(meal) => { setRegularEditId(meal.id); setRegularDraft({ name: meal.name, calories: String(meal.calories), protein: String(meal.protein) }); }} onRemove={(id) => void removeTdeeRegular(file, id).then(setFile)} />
          <MealEditor title={regularEditId ? 'Edit regular' : 'Add regular'} draft={regularDraft} editingId={regularEditId} onDraftChange={(p) => setRegularDraft((d) => ({ ...d, ...p }))} onSave={() => void saveMeal('regular', regularDraft, regularEditId, file.regulars, upsertTdeeRegular)} onCancel={() => { setRegularDraft(emptyDraft()); setRegularEditId(null); }} />
        </CardContent>
      </Card>
    </div>
  );
}
