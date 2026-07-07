import type { UserData } from './userData';

/** Total row-like records in a snapshot (config rows count as 1 each). */
export const totalUserDataRows = (data: UserData): number => {
  let n = (data.focusLog?.length ?? 0) + (data.workoutLog?.length ?? 0) + (data.appKv?.length ?? 0);
  n += (data.nutritionStaples?.length ?? 0) + (data.nutritionRegulars?.length ?? 0) + (data.nutritionEntries?.length ?? 0);
  n += (data.streakActivities?.length ?? 0) + (data.streakLogCells?.length ?? 0) + (data.streakActivityMeta?.length ?? 0);
  n += data.waterEntries?.length ?? 0;
  if (data.nutritionConfig) n += 1;
  if (data.waterConfig) n += 1;
  return n;
};

export const isUserDataEmpty = (data: UserData): boolean => totalUserDataRows(data) === 0;

export class DataWipeRefusedError extends Error {
  constructor(message = 'Refusing to replace non-empty data with an empty snapshot') {
    super(message);
    this.name = 'DataWipeRefusedError';
  }
}

/** Throws when an incoming snapshot would delete all existing user data. */
export const assertSafeSnapshotPush = (incoming: UserData, existingRowCount: number): void => {
  if (existingRowCount > 0 && isUserDataEmpty(incoming)) throw new DataWipeRefusedError();
};
