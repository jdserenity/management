import type { UserData } from './userData';

export const summarizeUserDataCounts = (data: Partial<UserData> | null | undefined): Record<string, number> => ({
  focusLog: data?.focusLog?.length ?? 0,
  workoutLog: data?.workoutLog?.length ?? 0,
  appKv: data?.appKv?.length ?? 0,
  nutritionStaples: data?.nutritionStaples?.length ?? 0,
  nutritionRegulars: data?.nutritionRegulars?.length ?? 0,
  nutritionEntries: data?.nutritionEntries?.length ?? 0,
  streakActivities: data?.streakActivities?.length ?? 0,
  streakLogCells: data?.streakLogCells?.length ?? 0,
  waterEntries: data?.waterEntries?.length ?? 0
});

export const logSyncInfo = (message: string, detail?: Record<string, unknown>): void => {
  if (detail) console.info(`[data-sync] ${message}`, detail);
  else console.info(`[data-sync] ${message}`);
};

export const logSyncError = (message: string, err: unknown, detail?: Record<string, unknown>): void => {
  const errMsg = err instanceof Error ? err.message : String(err);
  const errName = err instanceof Error ? err.name : undefined;
  console.error(`[data-sync] ${message}`, { ...detail, error: errMsg, errorName: errName, raw: err });
};

export const logSyncHttpFailure = async (method: string, url: string, res: Response): Promise<void> => {
  const body = await res.text().catch(() => '');
  console.error(`[data-sync] ${method} ${url} failed`, {
    status: res.status,
    statusText: res.statusText,
    body: body.slice(0, 800)
  });
};
