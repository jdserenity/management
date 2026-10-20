import { normalizeCalories, normalizeMacro } from '@/lib/tdee/ingredients';
import type { TdeeMealDef } from '@/lib/tdee/types';

export const mealIdFromName = (name: string, existing: TdeeMealDef[]): string => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'meal';
  let id = base;
  let n = 2;
  const ids = new Set(existing.map((m) => m.id));
  while (ids.has(id)) { id = `${base}-${n++}`; }
  return id;
};

export const upsertMeal = (meals: TdeeMealDef[], meal: TdeeMealDef, isNew: boolean): TdeeMealDef[] => {
  if (isNew) return [...meals, meal];
  const idx = meals.findIndex((m) => m.id === meal.id);
  if (idx < 0) return [...meals, meal];
  const next = [...meals];
  next[idx] = meal;
  return next;
};

export const removeMeal = (meals: TdeeMealDef[], id: string): TdeeMealDef[] => meals.filter((m) => m.id !== id);

/** True when the Daily custom-food row holds anything the Clear button should wipe (a picked regular fills all of these). */
export const hasCustomFoodInput = (f: { title: string; calories: string; protein: string; qty: string }): boolean =>
  f.title !== '' || f.calories !== '' || f.protein !== '' || f.qty !== '1';

/**
 * Build a new regular from a fruitless search: the searched name plus the
 * calories/protein currently typed in the custom row. Returns null when the
 * name is blank or no calories are entered yet (a regular needs calories).
 */
export const regularFromSearch = (
  search: string,
  caloriesRaw: string,
  proteinRaw: string,
  existing: TdeeMealDef[]
): TdeeMealDef | null => {
  const name = search.trim();
  const calories = normalizeCalories(Number(caloriesRaw));
  if (!name || !calories) return null;
  return { id: mealIdFromName(name, existing), name, calories, protein: normalizeMacro(Number(proteinRaw) || 0) };
};

/** Regulars matching a name search; an empty search shows nothing — regulars only appear once searched for. */
export const filterRegulars = (regulars: TdeeMealDef[], query: string): TdeeMealDef[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return regulars.filter((m) => m.name.toLowerCase().includes(q));
};
