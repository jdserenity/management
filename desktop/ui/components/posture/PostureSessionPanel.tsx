import { useMemo } from 'react';
import { longestGoodStreakCount, sessionStats } from '@/posture/postureAggregates';
import type { PostureLogRow } from '@/posture/postureLogDb';

const GOOD_STREAK_SCORE = 65;

export default function PostureSessionPanel({
  isMonitoring,
  historyRows,
  monitoringSinceSec,
  scoreHistory
}: {
  isMonitoring: boolean;
  historyRows: PostureLogRow[];
  monitoringSinceSec: number | null | undefined;
  scoreHistory: readonly number[];
}) {
  const sessionDbRows = useMemo(() => {
    if (!monitoringSinceSec) return [];
    return historyRows.filter((r) => r.timestamp >= monitoringSinceSec);
  }, [historyRows, monitoringSinceSec]);

  const sessionAgg = useMemo(() => {
    const fromDb = sessionStats(sessionDbRows.map((r) => ({ score: r.score })));
    if (fromDb && fromDb.count > 0) return fromDb;
    return sessionStats(scoreHistory.map((s) => ({ score: s })));
  }, [sessionDbRows, scoreHistory]);

  const streakSamples = useMemo(() => {
    if (sessionDbRows.length)
      return longestGoodStreakCount(sessionDbRows.map((r) => ({ score: r.score })), GOOD_STREAK_SCORE);
    return longestGoodStreakCount(scoreHistory.map((s) => ({ score: s })), GOOD_STREAK_SCORE);
  }, [sessionDbRows, scoreHistory]);

  return (
    <section className="plugin-panel space-y-3">
      <div>
        <h2 className="plugin-panel-title">This session</h2>
        <p className="plugin-muted text-sm">While tray tracking is on, samples are stored to your posture log.</p>
      </div>
      {!isMonitoring ? (
        <p className="plugin-muted text-sm">Use the button below to start posture tracking.</p>
      ) : sessionAgg ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="plugin-muted">Avg score</dt>
          <dd className="text-right font-semibold tabular-nums">{sessionAgg.avg}</dd>
          <dt className="plugin-muted">Min</dt>
          <dd className="text-right font-semibold tabular-nums">{sessionAgg.min}</dd>
          <dt className="plugin-muted">Max</dt>
          <dd className="text-right font-semibold tabular-nums">{sessionAgg.max}</dd>
          <dt className="plugin-muted">Samples</dt>
          <dd className="text-right font-semibold tabular-nums">{sessionAgg.count}</dd>
        </dl>
      ) : (
        <p className="plugin-muted text-sm">No samples yet.</p>
      )}
      <div className="border-t border-border pt-2">
        <p className="plugin-muted mb-1 text-xs">Good-posture streak</p>
        <p className="text-lg font-semibold tabular-nums">
          {streakSamples}{' '}
          <span className="text-sm font-normal plugin-muted">
            consecutive samples ≥ {GOOD_STREAK_SCORE}
          </span>
        </p>
        <p className="plugin-muted mt-1 text-xs">Bates-style streak: consecutive stored samples at or above the good threshold.</p>
      </div>
    </section>
  );
}
