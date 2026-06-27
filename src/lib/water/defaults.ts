import type { WaterFile } from '@/lib/water/types';

export const DEFAULT_WATER_TARGET_ML = 2500;

export const DEFAULT_WATER_FILE: WaterFile = {
  targetMl: DEFAULT_WATER_TARGET_ML,
  day: '',
  entries: []
};
