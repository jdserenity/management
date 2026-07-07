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
