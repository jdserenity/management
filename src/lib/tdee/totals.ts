import { activeEntries } from '@/lib/tdee/entries';
import type { TdeeLogEntry, TdeeStoredEntry } from '@/lib/tdee/types';

const entryCount = (entry: TdeeLogEntry): number =>
  typeof entry.count === 'number' && entry.count > 0 ? entry.count : 1;

export const entryCalories = (entry: TdeeLogEntry): number =>
  Math.max(0, Math.round(entry.calories)) * entryCount(entry);

export const entryProtein = (entry: TdeeLogEntry): number =>
  Math.max(0, Math.round(entry.protein || 0)) * entryCount(entry);

export const totalCalories = (entries: TdeeStoredEntry[]): number =>
  activeEntries(entries).reduce((sum, entry) => sum + entryCalories(entry), 0);

export const totalProtein = (entries: TdeeStoredEntry[]): number =>
  activeEntries(entries).reduce((sum, entry) => sum + entryProtein(entry), 0);

export const formatCalories = (n: number): string => Math.max(0, Math.round(n)).toLocaleString();

export const formatProtein = (n: number): string => Math.max(0, Math.round(n)).toLocaleString();

export const progressRatio = (total: number, target: number): number => {
  if (!target || target <= 0) return 0;
  return Math.min(1, total / target);
};

export const remainingDisplay = (total: number, tdee: number): { text: string; extraClass: string } => {
  const remaining = tdee - total;
  if (remaining >= 0) return { text: `${formatCalories(remaining)} kcal remaining`, extraClass: '' };
  return { text: `💪 ${formatCalories(Math.abs(remaining))} kcal over TDEE`, extraClass: ' tdee-remaining-surplus' };
};

export const proteinRemainingDisplay = (total: number, target: number): { text: string; extraClass: string } => {
  const remaining = target - total;
  if (remaining >= 0) return { text: `${formatProtein(remaining)} g remaining`, extraClass: '' };
  return { text: `💪 ${formatProtein(Math.abs(remaining))} g over target`, extraClass: ' tdee-remaining-surplus' };
};

export const formatChipMacros = (calories: number, protein: number): string =>
  `${Math.max(0, Math.round(calories))} / ${Math.max(0, Math.round(protein))}g`;
