/** Local-time hour (0–23) when the stats “day” rolls over. Default matches other apps. */
export const DEFAULT_DAY_ROLLOVER_HOUR = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

export const clampDayRolloverHour = (hour: number): number => {
  if (!Number.isFinite(hour)) return DEFAULT_DAY_ROLLOVER_HOUR;
  const h = Math.trunc(hour);
  if (h < 0) return 0;
  if (h > 23) return 23;
  return h;
};

/** Inclusive start, exclusive end — entries with `completedAt` in [startTs, endTs) count as “today”. */
export const getStatsDayWindow = (
  nowTimestamp: number = Date.now(),
  rolloverHour: number = DEFAULT_DAY_ROLLOVER_HOUR
): { startTs: number; endTs: number } => {
  const hour = clampDayRolloverHour(rolloverHour);
  const now = new Date(nowTimestamp);
  const start = new Date(now);
  start.setHours(hour, 0, 0, 0);
  if (now.getTime() < start.getTime()) start.setDate(start.getDate() - 1);
  const startTs = start.getTime();
  return { startTs, endTs: startTs + DAY_MS };
};

export const isTimestampInStatsDay = (
  timestamp: number,
  nowTimestamp: number = Date.now(),
  rolloverHour: number = DEFAULT_DAY_ROLLOVER_HOUR
): boolean => {
  const { startTs, endTs } = getStatsDayWindow(nowTimestamp, rolloverHour);
  return timestamp >= startTs && timestamp < endTs;
};

export const formatDayRolloverHourLabel = (hour: number): string => {
  const d = new Date();
  d.setHours(clampDayRolloverHour(hour), 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
