import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CustomizePanel } from '@/components/customize/CustomizePrimitives';
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
import { loadWaterFile, saveWaterTarget } from '@/lib/waterDb';
import { litresToMl, mlToLitres } from '@/lib/water/totals';
import { useAppDataLoad } from '@/lib/useAppDataLoad';

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

const Field = ({
  label,
  children,
  className = ''
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) => (
  <label className={`flex flex-col gap-1 text-xs plugin-muted ${className}`}>
    {label}
    {children}
  </label>
);

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
    <div className="plugin-panel-flat space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      <Field label="Name">
        <input className="plugin-input text-sm text-foreground" value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} />
      </Field>
      {draft.ingredients.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium plugin-muted">Ingredients</p>
          {draft.ingredients.map((row, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2">
              <Field label="Ingredient" className="min-w-[8rem] flex-1">
                <input className="plugin-input text-sm text-foreground" value={row.name} onChange={(e) => {
                  const ingredients = [...draft.ingredients];
                  ingredients[idx] = { ...row, name: e.target.value };
                  onDraftChange({ ...draft, ingredients });
                }} />
              </Field>
              <Field label="Calories">
                <input type="number" min={1} step={1} className="plugin-input w-20 tabular-nums text-foreground" value={row.calories} onChange={(e) => {
                  const ingredients = [...draft.ingredients];
                  ingredients[idx] = { ...row, calories: e.target.value };
                  onDraftChange({ ...draft, ingredients });
                }} />
              </Field>
              <Field label="Protein (g)">
                <input type="number" min={0} step={0.1} className="plugin-input w-20 tabular-nums text-foreground" value={row.protein} onChange={(e) => {
                  const ingredients = [...draft.ingredients];
                  ingredients[idx] = { ...row, protein: e.target.value };
                  onDraftChange({ ...draft, ingredients });
                }} />
              </Field>
              <button type="button" className="plugin-btn-ghost text-sm" onClick={() => onDraftChange({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== idx) })}>Remove</button>
            </div>
          ))}
          {ingredientTotals ? (
            <p className="plugin-muted text-xs">Total: {formatChipMacros(ingredientTotals.calories, ingredientTotals.protein)}</p>
          ) : null}
          <button type="button" className="plugin-btn text-sm" onClick={() => onDraftChange({ ...draft, ingredients: [...draft.ingredients, emptyIngredient()] })}>Add ingredient</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Calories">
            <input type="number" min={1} step={1} className="plugin-input w-20 tabular-nums text-foreground" value={draft.simpleCalories} onChange={(e) => onDraftChange({ ...draft, simpleCalories: e.target.value })} />
          </Field>
          <Field label="Protein (g)">
            <input type="number" min={0} step={0.1} className="plugin-input w-20 tabular-nums text-foreground" value={draft.simpleProtein} onChange={(e) => onDraftChange({ ...draft, simpleProtein: e.target.value })} />
          </Field>
          <button type="button" className="plugin-btn text-sm" onClick={() => onDraftChange({ ...draft, ingredients: [emptyIngredient()], simpleCalories: '', simpleProtein: '' })}>Use ingredients</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="plugin-btn plugin-btn-primary text-sm" onClick={onSave}>{editingId ? 'Save' : 'Add'}</button>
        {editingId ? <button type="button" className="plugin-btn-ghost text-sm" onClick={onCancel}>Cancel</button> : null}
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
  if (meals.length === 0) return <p className="plugin-empty text-xs">None yet.</p>;
  return (
    <ul className="space-y-2">
      {meals.map((meal) => (
        <li key={meal.id} className="plugin-panel-flat space-y-2">
          <div className="min-w-0">
            <p className="font-medium">{meal.name}</p>
            <p className="plugin-muted text-xs">{formatChipMacros(meal.calories, meal.protein)}</p>
            {meal.ingredients?.length ? (
              <p className="mt-1 plugin-muted text-xs">{formatIngredientsList(meal.ingredients)}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="plugin-btn text-sm" onClick={() => onEdit(meal)}>Edit</button>
            <button type="button" className="plugin-btn-ghost text-sm" onClick={() => onRemove(meal.id)}>Remove</button>
          </div>
        </li>
      ))}
    </ul>
  );
};

type FoodBundle = { file: TdeeFile; waterTargetDraft: string };

export default function CustomizeFoodPanel() {
  const loadBundle = useCallback(async (): Promise<FoodBundle> => {
    const [file, water] = await Promise.all([loadTdeeFile(), loadWaterFile()]);
    return { file, waterTargetDraft: water.targetMl ? String(mlToLitres(water.targetMl)) : '' };
  }, []);
  const { data, loadError, setData, storageReady } = useAppDataLoad(loadBundle, 'Failed to load nutrition data', { intervalMs: null, listenSync: false });
  const file = data?.file ?? null;
  const setFile = (next: TdeeFile | Promise<TdeeFile>) => {
    void Promise.resolve(next).then((f) => setData((b) => (b ? { ...b, file: f } : { file: f, waterTargetDraft: '' })));
  };
  const [tdeeDraft, setTdeeDraft] = useState('');
  const [proteinDraft, setProteinDraft] = useState('');
  const [stapleDraft, setStapleDraft] = useState<MealDraft>(emptyDraft);
  const [stapleEditId, setStapleEditId] = useState<string | null>(null);
  const [regularDraft, setRegularDraft] = useState<MealDraft>(emptyDraft);
  const [regularEditId, setRegularEditId] = useState<string | null>(null);
  const [waterTargetDraft, setWaterTargetDraft] = useState('');

  useEffect(() => {
    if (!data) return;
    setTdeeDraft(String(data.file.tdee || ''));
    setProteinDraft(String(data.file.protein || ''));
    setWaterTargetDraft(data.waterTargetDraft);
  }, [data]);

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

  if (!storageReady) return <p className="plugin-muted text-sm">Storage is not ready yet.</p>;
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
  if (!file) return <p className="plugin-muted text-sm">Loading food…</p>;

  return (
    <div className="space-y-4">
      <CustomizePanel title="Targets" description="Daily calorie, protein, and water goals shown on Daily.">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="TDEE (kcal)">
            <input type="number" min={0} step={1} className="plugin-input w-28 tabular-nums text-foreground" value={tdeeDraft} onChange={(e) => setTdeeDraft(e.target.value)} />
          </Field>
          <Field label="Protein (g)">
            <input type="number" min={0} step={0.1} className="plugin-input w-28 tabular-nums text-foreground" value={proteinDraft} onChange={(e) => setProteinDraft(e.target.value)} />
          </Field>
          <Field label="Water (L)">
            <input type="number" min={0} step={0.1} className="plugin-input w-28 tabular-nums text-foreground" value={waterTargetDraft} onChange={(e) => setWaterTargetDraft(e.target.value)} />
          </Field>
          <button
            type="button"
            className="plugin-btn plugin-btn-primary text-sm"
            onClick={() => void Promise.all([
              updateTdeeTargets(file, Number(tdeeDraft) || 0, Number(proteinDraft) || 0),
              loadWaterFile().then((w) => saveWaterTarget(w, litresToMl(Number(waterTargetDraft) || 0)))
            ]).then(([next]) => setFile(next))}
          >
            Save targets
          </button>
        </div>
      </CustomizePanel>

      <CustomizePanel title="Staples" description="One-tap items on the Daily food chain until logged each day. Totals sum from ingredients when you use them; otherwise set calories and protein directly.">
        <MealList meals={file.staples} onEdit={(meal) => { setStapleEditId(meal.id); setStapleDraft(mealToDraft(meal)); }} onRemove={(id) => void removeTdeeStaple(file, id).then(setFile)} />
        <MealEditor title={stapleEditId ? 'Edit staple' : 'Add staple'} draft={stapleDraft} editingId={stapleEditId} onDraftChange={setStapleDraft} onSave={() => void saveMeal(stapleDraft, stapleEditId, file.staples, upsertTdeeStaple, () => { setStapleDraft(emptyDraft()); setStapleEditId(null); })} onCancel={() => { setStapleDraft(emptyDraft()); setStapleEditId(null); }} />
      </CustomizePanel>

      <CustomizePanel title="Regulars" description="Reusable meals with default portions; log them from the + menu on Daily.">
        <MealList meals={file.regulars} onEdit={(meal) => { setRegularEditId(meal.id); setRegularDraft(mealToDraft(meal)); }} onRemove={(id) => void removeTdeeRegular(file, id).then(setFile)} />
        <MealEditor title={regularEditId ? 'Edit regular' : 'Add regular'} draft={regularDraft} editingId={regularEditId} onDraftChange={setRegularDraft} onSave={() => void saveMeal(regularDraft, regularEditId, file.regulars, upsertTdeeRegular, () => { setRegularDraft(emptyDraft()); setRegularEditId(null); })} onCancel={() => { setRegularDraft(emptyDraft()); setRegularEditId(null); }} />
      </CustomizePanel>
    </div>
  );
}
