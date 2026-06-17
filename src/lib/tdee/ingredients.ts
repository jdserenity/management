import type { TdeeIngredient } from '@/lib/tdee/types';

const normalizeIngredient = (name: string, raw: unknown): TdeeIngredient | null => {
  if (typeof raw === 'number') return { name, calories: Math.max(0, Math.round(raw)), protein: 0 };
  if (raw && typeof raw === 'object' && typeof (raw as { calories?: unknown }).calories === 'number') {
    const o = raw as { calories: number; protein?: number };
    return {
      name,
      calories: Math.max(0, Math.round(o.calories)),
      protein: Math.max(0, Math.round(typeof o.protein === 'number' ? o.protein : 0))
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
        calories: Math.max(0, Math.round(i.calories)),
        protein: Math.max(0, Math.round(typeof i.protein === 'number' ? i.protein : 0))
      }));
  }
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([name, value]) => normalizeIngredient(name, value))
      .filter((x): x is TdeeIngredient => x !== null);
  }
  return [];
};

export const formatIngredientsList = (ingredients: TdeeIngredient[] | undefined): string => {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return '';
  return ingredients.map((i) => `${i.name}: ${i.calories} / ${i.protein}g`).join(', ');
};
