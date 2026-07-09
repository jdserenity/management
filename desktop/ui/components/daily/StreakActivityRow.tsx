// src/components/daily/StreakActivityRow.tsx

import { useRef, useState } from 'react';
import { parseScheduledDays } from '@/lib/streak/activityCatalog';
import { getISOWeekStart, getWeekDays, parseDate } from '@/lib/streak/dates';
import { getLogState } from '@/lib/streak/logs';
import { currentStreakFireEmojiClass, streakDisplayTier } from '@/lib/streak/display';
import { getOverlapBadgeParts } from '@/lib/streak/overlap';
import { isElementTruncated } from '@/lib/streak/display';
import type { StreakActivity, StreakActivityStats, StreakLogState, StreakState } from '@/lib/streak/types';

const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type Props = {
  activity: StreakActivity;
  state: StreakState;
  onLog: (activityId: string, newState: StreakLogState | null, day?: string) => void;
  onEditDescription: (activityId: string, description: string) => void;
};

const StreakStat = ({ emoji, value, kind, title }: { emoji: string; value: number; kind: 'current' | 'longest'; title: string }) => {
  const tier = streakDisplayTier(value, kind);
  const tierCls = tier === 'none' ? '' : ` streak-streak-tier-${tier}`;
  const fireCls = kind === 'current' ? currentStreakFireEmojiClass(value) : null;
  return (
    <span className={`streak-stat streak-streak-display ${kind === 'current' ? 'streak-current' : 'streak-longest'}${tierCls}`} title={title}>
      {kind === 'current'
        ? (fireCls ? <span className={fireCls}>🔥</span> : null)
        : <span className="streak-streak-emoji">{emoji}</span>}
      <span className="streak-streak-num">{value}</span>
    </span>
  );
};

const DailyStats = ({ stats }: { stats: StreakActivityStats }) => {
  const successRate = stats.totalDays > 0 ? stats.totalSuccesses / stats.totalDays : 0;
  let rateColorCls = 'streak-rate-blue';
  if (successRate >= 0.9) rateColorCls = 'streak-rate-green';
  else if (successRate >= 0.7) rateColorCls = 'streak-rate-orange';
  else if (successRate < 0.3) rateColorCls = 'streak-rate-red';
  return (
    <div className="streak-stats">
      <StreakStat emoji="🔥" value={stats.currentStreak} kind="current" title="Current streak" />
      <StreakStat emoji="🔗" value={stats.longestStreak} kind="longest" title="Longest streak" />
      <span className="streak-stat streak-total" title="Total successes / Total days tracked">
        ✅ {stats.totalSuccesses}/{stats.totalDays} : <span className={rateColorCls}>{(successRate * 100).toFixed(2)}%</span>
      </span>
    </div>
  );
};

const WeeklyStats = ({ stats, weekSessionCount, weeklyTarget }: { stats: StreakActivityStats; weekSessionCount: number; weeklyTarget: number }) => {
  const weeklySuccesses = stats.weeklySuccesses ?? 0;
  const totalWeeks = stats.totalDays ?? 0;
  const weekRate = totalWeeks > 0 ? ((weeklySuccesses / totalWeeks) * 100).toFixed(0) : '0';
  return (
    <div className="streak-stats">
      <StreakStat emoji="🔥" value={stats.currentStreak} kind="current" title="Current streak (weeks)" />
      <StreakStat emoji="🔗" value={stats.longestStreak} kind="longest" title="Longest streak (weeks)" />
      <span className="streak-stat streak-total" title="Weeks target met / Total weeks tracked">✅ {weeklySuccesses}/{totalWeeks} : {weekRate}%</span>
      <span className="streak-stat streak-week-progress" title="Sessions logged this week">{weekSessionCount}/{weeklyTarget} this week</span>
    </div>
  );
};

const ActivityName = ({
  activity,
  descOpen,
  onToggleDescription
}: {
  activity: StreakActivity;
  descOpen: boolean;
  onToggleDescription: (opening: boolean) => void;
}) => {
  const nameRef = useRef<HTMLDivElement>(null);
  const [nameWrap, setNameWrap] = useState(false);
  const hasDescription = !!activity.description;
  const badgeParts = getOverlapBadgeParts(activity);

  const handleClick = () => {
    if (hasDescription) {
      const opening = !descOpen;
      if (opening && nameRef.current) setNameWrap(isElementTruncated(nameRef.current));
      else setNameWrap(false);
      onToggleDescription(opening);
      return;
    }
    // No description: still allow expanding a truncated title so the full name is readable.
    if (nameWrap) {
      setNameWrap(false);
      return;
    }
    if (nameRef.current && isElementTruncated(nameRef.current)) setNameWrap(true);
  };

  return (
    <div
      ref={nameRef}
      className={`streak-activity-name clickable${nameWrap ? ' streak-activity-name-wrap' : ''}`}
      onClick={handleClick}
      title={hasDescription ? 'Click to show description' : 'Click to expand full title'}
    >
      {activity.name || activity.id}
      {badgeParts.length ? (
        <span className="streak-overlap-badge">
          {badgeParts.map((part, i) => (
            <span key={`${part.kind}-${part.text}-${i}`} className="streak-overlap-part">
              {i > 0 ? <span className="streak-overlap-sep"> · </span> : null}
              {part.kind === 'necessary' ? (
                <span className="streak-necessary-label" title="Necessary — missing this fails the day">
                  <span className="streak-necessary-dot" aria-hidden />
                  necessary
                </span>
              ) : (
                part.text
              )}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
};

export default function StreakActivityRow({ activity, state, onLog, onEditDescription }: Props) {
  const isPaused = !!state.data.pausedActivities[activity.id];
  const stats = state.data.stats[activity.id] || { currentStreak: 0, longestStreak: 0, totalSuccesses: 0, totalDays: 0 };
  const [descOpen, setDescOpen] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(activity.description || '');
  const today = state.currentDay;

  if (activity.frequency === 'weekly') {
    const weeklyTarget = activity.weeklyTarget || 1;
    const weekStart = getISOWeekStart(today);
    const weekDays = getWeekDays(weekStart);
    let sessionCount = 0;
    const scheduledIndices = activity.scheduledDays?.length ? parseScheduledDays(activity.scheduledDays) : [];

    return (
      <div className={`streak-activity${isPaused ? ' streak-activity-paused' : ''}`}>
        <div className="streak-activity-header">
          <div className={`streak-buttons streak-buttons-weekly`}>
            {scheduledIndices.length ? weekDays.map((dayDate) => {
              const d = parseDate(dayDate);
              const dayIndex = d.getDay();
              if (!scheduledIndices.includes(dayIndex)) return null;
              const dayLog = state.data.logs[dayDate]?.[activity.id];
              const isFuture = dayDate > today;
              const isPast = dayDate < today;
              const isSuccess = getLogState(dayLog) === 'success';
              if (isSuccess) sessionCount++;
              const necessary = !!activity.necessary;
              let cls = 'streak-day-chip streak-btn-primary';
              if (isSuccess) cls += necessary ? ' streak-day-chip-success-gold' : ' streak-day-chip-success';
              else if (isPast) cls += ' streak-day-chip-failed';
              else if (isFuture) cls += ' streak-day-chip-future';
              else cls += ' streak-day-chip-today';
              return (
                <button key={dayDate} type="button" className={cls} title={isSuccess ? 'Click to undo' : isFuture ? '' : 'Log today'} disabled={isFuture} onClick={() => {
                  if (isSuccess) onLog(activity.id, null, dayDate);
                  else if (!isFuture && !isPast) onLog(activity.id, 'success', dayDate);
                }}>
                  <span className="streak-day-chip-label">{DAY_ABBR[dayIndex]}</span>
                </button>
              );
            }) : (() => {
              const sessionsThisWeek = weekDays.filter((day) => getLogState(state.data.logs[day]?.[activity.id]) === 'success');
              sessionCount = sessionsThisWeek.length;
              const todayLogged = sessionsThisWeek.includes(today);
              const necessary = !!activity.necessary;
              return Array.from({ length: weeklyTarget }, (_, i) => {
                const isActive = i < sessionCount;
                const isNext = i === sessionCount && !todayLogged;
                return (
                  <button key={i} type="button" className={`streak-btn streak-btn-success streak-btn-primary${necessary ? ' streak-btn-necessary' : ''}${isActive ? ' streak-btn-active' : ''}${!isActive && !isNext ? ' streak-btn-locked' : ''}`} disabled={!isActive && !isNext} onClick={() => {
                    if (isActive) onLog(activity.id, null, sessionsThisWeek[i]);
                    else if (isNext) onLog(activity.id, 'success', today);
                  }}>✓</button>
                );
              });
            })()}
          </div>
          <ActivityName activity={activity} descOpen={descOpen} onToggleDescription={setDescOpen} />
          <WeeklyStats stats={stats} weekSessionCount={sessionCount} weeklyTarget={weeklyTarget} />
        </div>
        {activity.description ? (
          <div className={`streak-activity-description${descOpen ? '' : ' collapsed'}`}>
            {editingDesc ? (
              <textarea className="streak-description-editor" value={descDraft} onChange={(e) => setDescDraft(e.target.value)} onBlur={() => { setEditingDesc(false); onEditDescription(activity.id, descDraft); }} />
            ) : (
              <p title="Double-click to edit" onDoubleClick={() => { setDescDraft(activity.description || ''); setEditingDesc(true); setDescOpen(true); }}>{activity.description}</p>
            )}
          </div>
        ) : null}
        {isPaused ? <div className="streak-pause-overlay" /> : null}
      </div>
    );
  }

  const currentState = getLogState(state.data.logs[today]?.[activity.id]);
  const necessary = !!activity.necessary;

  return (
    <div className={`streak-activity${isPaused ? ' streak-activity-paused' : ''}`}>
      <div className="streak-activity-header">
        <div className="streak-buttons">
          <button
            type="button"
            className={`streak-btn streak-btn-success streak-btn-primary${necessary ? ' streak-btn-necessary' : ''}${currentState === 'success' ? ' streak-btn-active' : ''}`}
            title="Mark as success"
            onClick={() => onLog(activity.id, currentState === 'success' ? null : 'success')}
          >
            ✓
          </button>
        </div>
        <ActivityName activity={activity} descOpen={descOpen} onToggleDescription={setDescOpen} />
        <DailyStats stats={stats} />
      </div>
      {activity.description ? (
        <div className={`streak-activity-description${descOpen ? '' : ' collapsed'}`}>
          {editingDesc ? (
            <textarea className="streak-description-editor" value={descDraft} onChange={(e) => setDescDraft(e.target.value)} onBlur={() => { setEditingDesc(false); onEditDescription(activity.id, descDraft); }} />
          ) : (
            <p title="Double-click to edit" onDoubleClick={() => { setDescDraft(activity.description || ''); setEditingDesc(true); setDescOpen(true); }}>{activity.description}</p>
          )}
        </div>
      ) : null}
      {isPaused ? <div className="streak-pause-overlay" /> : null}
    </div>
  );
}
