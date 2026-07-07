export type TdeeIngredient = { name: string; calories: number; protein: number };

export type TdeeMealDef = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  ingredients?: TdeeIngredient[];
};

export type TdeeEntryKind = 'staple' | 'regular' | 'custom';

export type TdeeLogEntry = {
  id: string;
  kind: TdeeEntryKind;
  refId: string | null;
  label: string;
  calories: number;
  protein: number;
  count: number;
  updatedAt: string;
};

export type TdeeTombstone = { id: string; deleted: true; updatedAt: string };

export type TdeeStoredEntry = TdeeLogEntry | TdeeTombstone;

export type TdeeFile = {
  tdee: number;
  protein: number;
  staples: TdeeMealDef[];
  regulars: TdeeMealDef[];
  day: string;
  entries: TdeeStoredEntry[];
};
