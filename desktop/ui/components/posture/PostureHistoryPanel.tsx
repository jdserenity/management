import { useCallback, useMemo } from 'react';
import { dailyAverageScores } from '@/posture/postureAggregates';
import { rowsToCsv, type PostureLogRow } from '@/posture/postureLogDb';
import { Download, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function PostureHistoryPanel({
  historyRows,
  historyLoading,
  onRefresh
}: {
  historyRows: PostureLogRow[];
  historyLoading: boolean;
  onRefresh: () => void;
}) {
  const chartData = useMemo(() => {
    const pts = historyRows.map((r) => ({ score: r.score, timestamp: r.timestamp }));
    return dailyAverageScores(pts, 14).map((d) => ({ label: d.day.slice(5), avg: d.avg, n: d.count }));
  }, [historyRows]);

  const exportCsv = useCallback(() => {
    const csv = rowsToCsv(historyRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `posture_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [historyRows]);

  return (
    <section className="plugin-panel space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="plugin-panel-title">History</h2>
          <p className="plugin-muted text-sm">Daily average score (last 14 days with data).</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="plugin-btn text-sm" onClick={onRefresh} disabled={historyLoading}>
            <RefreshCw className={`mr-1 inline h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" className="plugin-btn text-sm" onClick={exportCsv} disabled={!historyRows.length}>
            <Download className="mr-1 inline h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>
      <div className="h-56">
        {chartData.length === 0 ? (
          <p className="plugin-empty py-8 text-center text-sm">No posture log data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} />
              <Tooltip
                formatter={(value) => {
                  const n = typeof value === 'number' ? value : Number(value);
                  return [`${Number.isFinite(n) ? n : '—'}`, 'Daily avg'];
                }}
              />
              <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Avg score" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
