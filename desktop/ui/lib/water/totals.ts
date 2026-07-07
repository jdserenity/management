import { activeEntries } from '@/lib/water/entries';
import type { WaterEntry, WaterStoredEntry } from '@/lib/water/types';

const entryCount = (entry: WaterEntry): number =>
  typeof entry.count === 'number' && entry.count > 0 ? entry.count : 1;

export const entryMl = (entry: WaterEntry): number => entry.ml * entryCount(entry);

export const totalWater = (entries: WaterStoredEntry[]): number =>
  activeEntries(entries).reduce((sum, entry) => sum + entryMl(entry), 0);

export const formatMl = (n: number): string => Math.round(n).toLocaleString();

const formatLitresValue = (litres: number): string => {
  const rounded = Math.round(litres * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, '');
};

export const mlToLitres = (ml: number): number => ml / 1000;

export const litresToMl = (litres: number): number => Math.round(litres * 1000);

export const formatLitres = (ml: number): string => `${formatLitresValue(mlToLitres(ml))} L`;

export const formatWaterLabel = (ml: number): string => {
  if (ml >= 1000 && ml % 1000 === 0) return `${ml / 1000} L`;
  return `${formatMl(ml)} ml`;
};

export const progressRatio = (total: number, target: number): number => {
  if (!target || target <= 0) return 0;
  return Math.min(1, total / target);
};

export const remainingDisplay = (total: number, target: number): { text: string; extraClass: string } => {
  const remaining = target - total;
  if (remaining >= 0) return { text: `${formatMl(remaining)} ml remaining`, extraClass: '' };
  return { text: `💧 ${formatMl(Math.abs(remaining))} ml over target`, extraClass: ' water-remaining-surplus' };
};
