import type { TdeeIngredient } from '@/lib/tdee/types';

/** Keep macros as numbers; round protein to 2 decimal places to limit float noise. Calories stay whole numbers. */
export const normalizeMacro = (n: number): number => {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
};

export const normalizeCalories = (n: number): number => {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

const normalizeIngredient = (name: string, raw: unknown): TdeeIngredient | null => {
  if (typeof raw === 'number') return { name, calories: normalizeCalories(raw), protein: 0 };
  if (raw && typeof raw === 'object' && typeof (raw as { calories?: unknown }).calories === 'number') {
    const o = raw as { calories: number; protein?: number };
    return {
      name,
      calories: normalizeCalories(o.calories),
      protein: normalizeMacro(typeof o.protein === 'number' ? o.protein : 0)
    };
  }
  return null;
};

export const normalizeIngredients = (raw: unknown): TdeeIngredient[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((i) => i && typeof i.name === 'string' && typeof i.calories === 'number')
      .map((i) => ({
        name: i.name,
        calories: normalizeCalories(i.calories),
        protein: normalizeMacro(typeof i.protein === 'number' ? i.protein : 0)
      }));
  }
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([name, value]) => normalizeIngredient(name, value))
      .filter((x): x is TdeeIngredient => x !== null);
  }
  return [];
};

export const sumIngredientTotals = (ingredients: TdeeIngredient[]): { calories: number; protein: number } =>
  ingredients.reduce(
    (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein }),
    { calories: 0, protein: 0 }
  );

export const mealTotalsFromIngredients = (ingredients: TdeeIngredient[]): { calories: number; protein: number } => {
  const totals = sumIngredientTotals(ingredients);
  return { calories: normalizeCalories(totals.calories), protein: normalizeMacro(totals.protein) };
};

export const formatIngredientProtein = (protein: number): string => {
  const v = normalizeMacro(protein);
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
};

export const formatIngredientsList = (ingredients: TdeeIngredient[] | undefined): string => {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return '';
  return ingredients.map((i) => `${i.name}: ${i.calories} / ${formatIngredientProtein(i.protein)}g`).join(', ');
};
