import { getDb } from '@/lib/db';

export type PostureLogRow = {
  id: number;
  score: number;
  is_turtle_neck: number;
  is_shoulder_misaligned: number;
  timestamp: number;
  metrics_json: string | null;
};

export async function fetchPostureLogsSince(sinceUnixSec: number): Promise<PostureLogRow[]> {
  const db = await getDb();
  return db.select<PostureLogRow[]>(
    'SELECT id, score, is_turtle_neck, is_shoulder_misaligned, timestamp, metrics_json FROM posture_log WHERE timestamp >= $1 ORDER BY timestamp ASC',
    [sinceUnixSec],
  );
}

export async function fetchPostureLogsLastDays(days: number): Promise<PostureLogRow[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return fetchPostureLogsSince(since);
}

export function rowsToCsv(rows: PostureLogRow[]): string {
  const header = 'id,timestamp,score,is_turtle_neck,is_shoulder_misaligned,metrics_json';
  const lines = rows.map((r) =>
    [
      r.id,
      r.timestamp,
      r.score,
      r.is_turtle_neck,
      r.is_shoulder_misaligned,
      r.metrics_json ? `"${r.metrics_json.replace(/"/g, '""')}"` : '',
    ].join(','),
  );
  return [header, ...lines].join('\n');
}
