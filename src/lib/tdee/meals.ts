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
