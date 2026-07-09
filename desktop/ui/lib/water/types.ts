export type WaterEntry = {
  id: string;
  label: string;
  ml: number;
  count: number;
  updatedAt: string;
};

export type WaterTombstone = { id: string; deleted: true; updatedAt: string };

export type WaterStoredEntry = WaterEntry | WaterTombstone;

export type WaterFile = {
  targetMl: number;
  day: string;
  entries: WaterStoredEntry[];
};

export const DEFAULT_WATER_TARGET_ML = 2500;

export const DEFAULT_WATER_FILE: WaterFile = {
  targetMl: DEFAULT_WATER_TARGET_ML,
  day: '',
  entries: []
};
