import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatChipMacros } from '@/lib/tdee/totals';
import { formatIngredientsList, mealTotalsFromIngredients, normalizeCalories, normalizeMacro } from '@/lib/tdee/ingredients';
import { normalizeMealDef } from '@/lib/tdee/normalize';
import { mealIdFromName } from '@/lib/tdee/meals';
import type { TdeeFile, TdeeIngredient, TdeeMealDef } from '@/lib/tdee/types';
import {
  loadTdeeFile,
  removeTdeeRegular,
  removeTdeeStaple,
  updateTdeeTargets,
  upsertTdeeRegular,
  upsertTdeeStaple
} from '@/lib/tdeeDb';
import { isTauri } from '@/lib/isTauri';

type IngredientDraft = { name: string; calories: string; protein: string };
type MealDraft = { name: string; ingredients: IngredientDraft[]; simpleCalories: string; simpleProtein: string };

const emptyIngredient = (): IngredientDraft => ({ name: '', calories: '', protein: '' });
const emptyDraft = (): MealDraft => ({ name: '', ingredients: [], simpleCalories: '', simpleProtein: '' });

const mealToDraft = (meal: TdeeMealDef): MealDraft => {
  if (meal.ingredients?.length) {
    return {
      name: meal.name,
      ingredients: meal.ingredients.map((i) => ({ name: i.name, calories: String(i.calories), protein: String(i.protein) })),
      simpleCalories: '',
      simpleProtein: ''
    };
  }
  return { name: meal.name, ingredients: [], simpleCalories: String(meal.calories), simpleProtein: String(meal.protein) };
};

const parseIngredients = (draft: IngredientDraft[]): TdeeIngredient[] =>
  draft
    .map((row) => {
      const name = row.name.trim();
      const calories = normalizeCalories(Number(row.calories));
      const protein = normalizeMacro(Number(row.protein) || 0);
      if (!name || !calories) return null;
      return { name, calories, protein };
    })
    .filter((x): x is TdeeIngredient => x !== null);

const buildMealFromDraft = (draft: MealDraft, editId: string | null, meals: TdeeMealDef[]): TdeeMealDef | null => {
  const name = draft.name.trim();
  if (!name) return null;
  const id = editId || mealIdFromName(name, meals);
  if (draft.ingredients.length > 0) {
    const ingredients = parseIngredients(draft.ingredients);
    if (!ingredients.length) return null;
    return normalizeMealDef({ id, name, calories: 0, protein: 0, ingredients });
  }
  const calories = normalizeCalories(Number(draft.simpleCalories));
  const protein = normalizeMacro(Number(draft.simpleProtein) || 0);
  if (!calories) return null;
  return normalizeMealDef({ id, name, calories, protein });
};

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
  onDraftChange: (next: MealDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const ingredientTotals = useMemo(() => {
    const ingredients = parseIngredients(draft.ingredients);
    return ingredients.length ? mealTotalsFromIngredients(ingredients) : null;
  }, [draft.ingredients]);

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 px-3 py-3">
      <p className="text-sm font-semibold">{title}</p>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Name</span>
        <input className="rounded-md border border-input bg-background px-2 py-1 text-sm" value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} />
      </label>
      {draft.ingredients.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Ingredients</p>
          {draft.ingredients.map((row, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Ingredient</span>
                <input className="rounded-md border border-input bg-background px-2 py-1 text-sm" value={row.name} onChange={(e) => {
                  const ingredients = [...draft.ingredients];
                  ingredients[idx] = { ...row, name: e.target.value };
                  onDraftChange({ ...draft, ingredients });
                }} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Calories</span>
                <input type="number" min={1} step={1} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={row.calories} onChange={(e) => {
                  const ingredients = [...draft.ingredients];
                  ingredients[idx] = { ...row, calories: e.target.value };
                  onDraftChange({ ...draft, ingredients });
                }} />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Protein (g)</span>
                <input type="number" min={0} step={0.1} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={row.protein} onChange={(e) => {
                  const ingredients = [...draft.ingredients];
                  ingredients[idx] = { ...row, protein: e.target.value };
                  onDraftChange({ ...draft, ingredients });
                }} />
              </label>
              <Button type="button" size="sm" variant="ghost" onClick={() => onDraftChange({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== idx) })}>Remove</Button>
            </div>
          ))}
          {ingredientTotals ? (
            <p className="text-xs text-muted-foreground">Total: {formatChipMacros(ingredientTotals.calories, ingredientTotals.protein)}</p>
          ) : null}
          <Button type="button" size="sm" variant="secondary" onClick={() => onDraftChange({ ...draft, ingredients: [...draft.ingredients, emptyIngredient()] })}>Add ingredient</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Calories</span>
            <input type="number" min={1} step={1} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={draft.simpleCalories} onChange={(e) => onDraftChange({ ...draft, simpleCalories: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Protein (g)</span>
            <input type="number" min={0} step={0.1} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={draft.simpleProtein} onChange={(e) => onDraftChange({ ...draft, simpleProtein: e.target.value })} />
          </label>
          <Button type="button" size="sm" variant="secondary" onClick={() => onDraftChange({ ...draft, ingredients: [emptyIngredient()], simpleCalories: '', simpleProtein: '' })}>Use ingredients</Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onSave}>{editingId ? 'Save' : 'Add'}</Button>
        {editingId ? <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button> : null}
      </div>
    </div>
  );
};

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
        <li key={meal.id} className="flex flex-col gap-2 rounded-md border px-3 py-2">
          <div className="min-w-0">
            <p className="font-medium">{meal.name}</p>
            <p className="text-xs text-muted-foreground">{formatChipMacros(meal.calories, meal.protein)}</p>
            {meal.ingredients?.length ? (
              <p className="mt-1 text-xs text-muted-foreground">{formatIngredientsList(meal.ingredients)}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
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
    draft: MealDraft,
    editId: string | null,
    meals: TdeeMealDef[],
    upsert: (f: TdeeFile, meal: TdeeMealDef, isNew: boolean) => Promise<TdeeFile>,
    clear: () => void
  ) => {
    if (!file) return;
    const meal = buildMealFromDraft(draft, editId, meals);
    if (!meal) return;
    setFile(await upsert(file, meal, !editId));
    clear();
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
              <input type="number" min={0} step={1} className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={tdeeDraft} onChange={(e) => setTdeeDraft(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Protein (g)</span>
              <input type="number" min={0} step={0.1} className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums" value={proteinDraft} onChange={(e) => setProteinDraft(e.target.value)} />
            </label>
            <Button type="button" size="sm" onClick={() => void updateTdeeTargets(file, Number(tdeeDraft) || 0, Number(proteinDraft) || 0).then(setFile)}>Save targets</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Staples</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">One-tap items on the Daily food chain until logged each day. Totals sum from ingredients when you use them; otherwise set calories and protein directly (e.g. olive oil).</p>
          <MealList meals={file.staples} onEdit={(meal) => { setStapleEditId(meal.id); setStapleDraft(mealToDraft(meal)); }} onRemove={(id) => void removeTdeeStaple(file, id).then(setFile)} />
          <MealEditor title={stapleEditId ? 'Edit staple' : 'Add staple'} draft={stapleDraft} editingId={stapleEditId} onDraftChange={setStapleDraft} onSave={() => void saveMeal(stapleDraft, stapleEditId, file.staples, upsertTdeeStaple, () => { setStapleDraft(emptyDraft()); setStapleEditId(null); })} onCancel={() => { setStapleDraft(emptyDraft()); setStapleEditId(null); }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Regulars</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Reusable meals with default portions; log them from the + menu on Daily.</p>
          <MealList meals={file.regulars} onEdit={(meal) => { setRegularEditId(meal.id); setRegularDraft(mealToDraft(meal)); }} onRemove={(id) => void removeTdeeRegular(file, id).then(setFile)} />
          <MealEditor title={regularEditId ? 'Edit regular' : 'Add regular'} draft={regularDraft} editingId={regularEditId} onDraftChange={setRegularDraft} onSave={() => void saveMeal(regularDraft, regularEditId, file.regulars, upsertTdeeRegular, () => { setRegularDraft(emptyDraft()); setRegularEditId(null); })} onCancel={() => { setRegularDraft(emptyDraft()); setRegularEditId(null); }} />
        </CardContent>
      </Card>
    </div>
  );
}
