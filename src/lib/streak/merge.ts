import { pausedStateFromVault, mergePausedOnIncoming } from '@/lib/streak/pauseSync';
import { mergeResetCounts } from '@/lib/streak/activityReset';
import { getLogState, cellUpdatedAt, normalizeLogCell, normalizeLogs } from '@/lib/streak/logs';
import type { StreakData, StreakLogCell } from '@/lib/streak/types';

type MergeMode = 'bootstrap' | 'save' | 'incoming';

const mergeLogCell = (
  localCell: StreakLogCell | null | undefined,
  remoteCell: StreakLogCell | null | undefined,
  preferLocalOnTie = false,
  localWinsAbsent = false
): StreakLogCell | null => {
  const lState = getLogState(localCell);
  const rState = getLogState(remoteCell);
  const lIsDel = localCell && localCell.state === 'none';
  const rIsDel = remoteCell && remoteCell.state === 'none';

  if ((lState == null || lIsDel) && (rState == null || rIsDel)) {
    if (lState == null && rState == null) return null;
    if (lState == null) return normalizeLogCell(remoteCell);
    if (rState == null) return normalizeLogCell(localCell);
    const lAt = cellUpdatedAt(localCell);
    const rAt = cellUpdatedAt(remoteCell);
    if (lAt > rAt) return normalizeLogCell(localCell);
    if (rAt > lAt) return normalizeLogCell(remoteCell);
    return normalizeLogCell(preferLocalOnTie ? localCell : remoteCell);
  }

  if (lIsDel && rState != null) {
    const lAt = cellUpdatedAt(localCell);
    const rAt = cellUpdatedAt(remoteCell);
    if (lAt > rAt) return normalizeLogCell(localCell);
    if (rAt > lAt) return normalizeLogCell(remoteCell);
    return normalizeLogCell(preferLocalOnTie ? localCell : remoteCell);
  }

  if (rIsDel && lState != null) {
    const lAt = cellUpdatedAt(localCell);
    const rAt = cellUpdatedAt(remoteCell);
    if (rAt > lAt) return normalizeLogCell(remoteCell);
    if (lAt > rAt) return normalizeLogCell(localCell);
    return normalizeLogCell(preferLocalOnTie ? localCell : remoteCell);
  }

  if (lState == null && rState == null) return null;
  if (lState == null) return localWinsAbsent ? null : normalizeLogCell(remoteCell);
  if (rState == null) return normalizeLogCell(localCell);
  const lAt = cellUpdatedAt(localCell);
  const rAt = cellUpdatedAt(remoteCell);
  if (lAt > rAt) return normalizeLogCell(localCell);
  if (rAt > lAt) return normalizeLogCell(remoteCell);
  return normalizeLogCell(preferLocalOnTie ? localCell : remoteCell);
};

export const mergeLogs = (
  localLogs: StreakData['logs'] | undefined,
  remoteLogs: StreakData['logs'] | undefined,
  opts: { today?: string; mode?: MergeMode; skipActivityIds?: Set<string> } = {}
): StreakData['logs'] => {
  const local = normalizeLogs(localLogs);
  const remote = normalizeLogs(remoteLogs);
  const out: StreakData['logs'] = {};
  const dates = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const date of dates) {
    const acts = new Set([...Object.keys(local[date] || {}), ...Object.keys(remote[date] || {})]);
    const day: Record<string, StreakLogCell> = {};
    for (const act of acts) {
      if (opts.skipActivityIds?.has?.(act)) continue;
      const isToday = date === opts.today;
      const preferLocalOnTie = (opts.mode === 'incoming' && isToday) || (opts.mode === 'save' && isToday);
      const localWinsAbsent = preferLocalOnTie;
      const merged = mergeLogCell(local[date]?.[act], remote[date]?.[act], preferLocalOnTie, localWinsAbsent);
      if (merged) day[act] = merged;
    }
    if (Object.keys(day).length) out[date] = day;
  }
  return out;
};

export const mergeStartDates = (
  local: Record<string, string> | undefined,
  remote: Record<string, string> | undefined,
  skipActivityIds?: Set<string>
): Record<string, string> => {
  const out = { ...(local || {}) };
  for (const [act, date] of Object.entries(remote || {})) {
    if (skipActivityIds?.has?.(act)) continue;
    if (!out[act] || date < out[act]) out[act] = date;
  }
  return out;
};

export const mergeState = (opts: {
  local: Partial<StreakData> | null;
  remote: Partial<StreakData> | null;
  mode: MergeMode;
  today?: string;
  skipActivityIds?: Set<string>;
}): Pick<StreakData, 'logs' | 'activityStartDates' | 'pausedActivities' | 'unpausedActivities' | 'activityResetCounts'> => {
  const l = opts.local || {};
  const r = opts.remote || {};
  const logs = mergeLogs(l.logs, r.logs, { today: opts.today, mode: opts.mode, skipActivityIds: opts.skipActivityIds });
  const activityStartDates = mergeStartDates(l.activityStartDates, r.activityStartDates, opts.skipActivityIds);
  const activityResetCounts = mergeResetCounts(l.activityResetCounts, r.activityResetCounts);

  let pausedActivities: Record<string, string>;
  let unpausedActivities: Record<string, string>;

  if (opts.mode === 'bootstrap') {
    unpausedActivities = { ...(r.unpausedActivities || {}) };
    pausedActivities = pausedStateFromVault(r.pausedActivities, unpausedActivities);
  } else if (opts.mode === 'save') {
    pausedActivities = { ...(l.pausedActivities || {}) };
    unpausedActivities = { ...(l.unpausedActivities || {}) };
  } else {
    const merged = mergePausedOnIncoming(l.pausedActivities, l.unpausedActivities, r.pausedActivities, r.unpausedActivities);
    pausedActivities = merged.pausedActivities;
    unpausedActivities = merged.unpausedActivities;
  }

  return { logs, activityStartDates, pausedActivities, unpausedActivities, activityResetCounts };
};
