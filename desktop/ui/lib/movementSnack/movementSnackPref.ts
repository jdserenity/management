import { jsonPref } from '@/lib/appKv';
import { normalizeMovementSnackPrefs, type MovementSnackPrefs } from './movementSnack';

export const KV_MOVEMENT_SNACK_PREFS = 'movement_snack_prefs_v1';

const pref = jsonPref<MovementSnackPrefs>(KV_MOVEMENT_SNACK_PREFS, (raw) =>
  normalizeMovementSnackPrefs(raw as Partial<MovementSnackPrefs> | null)
);

export const loadMovementSnackPrefs = (): Promise<MovementSnackPrefs> => pref.load();
export const saveMovementSnackPrefs = (prefs: MovementSnackPrefs): Promise<void> => pref.save(prefs);
