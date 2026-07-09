import { boolPref } from '@/lib/appKv';

export const KV_CANT_EXERCISE_MODE = 'cant_exercise_mode_v1';

const pref = boolPref(KV_CANT_EXERCISE_MODE, {
  defaultValue: false,
  mode: 'defaultOff',
  encode: 'truefalse'
});

/** Off by default — full exercise pool on scheduled breaks. */
export const isCantExerciseModeEnabled = (): Promise<boolean> => pref.load();
export const setCantExerciseModeEnabled = (enabled: boolean): Promise<void> => pref.save(enabled);
