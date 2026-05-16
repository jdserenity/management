export type ScorePoint = { score: number; timestamp: number };

const DAY_SEC = 86400;

export function meanRounded(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

/** Longest run of samples at or above threshold (Bates-style “good streak” in sample units). */
export function longestGoodStreakCount(rows: readonly { score: number }[], threshold = 65): number {
  let best = 0;
  let cur = 0;
  for (const r of rows) {
    if (r.score >= threshold) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

export function sessionStats(rows: readonly { score: number }[]): { count: number; avg: number; min: number; max: number } | null {
  if (!rows.length) return null;
  const scores = rows.map((r) => r.score);
  return {
    count: scores.length,
    avg: meanRounded(scores),
    min: Math.min(...scores),
    max: Math.max(...scores),
  };
}

/** Bucket by calendar day (UTC) for last `days` days → average score per day. */
export function dailyAverageScores(rows: readonly ScorePoint[], days = 7): { day: string; avg: number; count: number }[] {
  const now = Math.floor(Date.now() / 1000);
  const start = now - days * DAY_SEC;
  const map = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    if (r.timestamp < start) continue;
    const d = new Date(r.timestamp * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const prev = map.get(key) ?? { sum: 0, n: 0 };
    prev.sum += r.score;
    prev.n += 1;
    map.set(key, prev);
  }
  const keys = [...map.keys()].sort();
  return keys.map((day) => {
    const { sum, n } = map.get(day)!;
    return { day, avg: n ? Math.round((sum / n) * 10) / 10 : 0, count: n };
  });
}
