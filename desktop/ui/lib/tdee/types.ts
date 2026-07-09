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

export const DEFAULT_TDEE_FILE: TdeeFile = {
  tdee: 0,
  protein: 0,
  staples: [],
  regulars: [],
  day: '',
  entries: []
};

export const CHAIN_CONNECTOR_SVG = `<svg class="tdee-chain-connector-svg" viewBox="0 0 34 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="1" y="3" width="15" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
  <rect x="18" y="3" width="15" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
</svg>`;

export const CHAIN_CLIP_WIDTH = 14;
export const CHAIN_SVG_WIDTH = 34;
export const CHAIN_SVG_OFFSET = -Math.round((CHAIN_SVG_WIDTH - CHAIN_CLIP_WIDTH) / 2);
