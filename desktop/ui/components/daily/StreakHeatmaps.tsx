// src/components/daily/StreakHeatmaps.tsx

import { useMemo } from 'react';
import { buildActivityCatalog } from '@/lib/streak/activityCatalog';
import { formatDate, getISOWeekStart, getWeekDays, isDateInWeek, parseDate } from '@/lib/streak/dates';
import { getDayCompletionCounts, isDayNecessaryFailed, isPerfectHeatmapCell } from '@/lib/streak/heatmapHelpers';
import { heatmapMonthSpans, weekColumnMonthFromDates } from '@/lib/streak/heatmapLayout';
import { getLogState } from '@/lib/streak/logs';
import { getWeeklyYearsWithData, getYearsWithData, heatmapLevel, hexToRgba } from '@/lib/streak/heatmapUi';
import type { StreakState } from '@/lib/streak/types';

type Props = {
  state: StreakState;
  year: number;
  onYearChange: (y: number) => void;
  heatmapColor?: string | null;
};

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

export function StreakDailyHeatmap({ state, year, onYearChange, heatmapColor }: Props) {
  const catalog = useMemo(() => buildActivityCatalog(state.config, state.data), [state]);
  const years = useMemo(() => getYearsWithData(state.data), [state.data]);
  const today = state.currentDay;
  const showNav = years.length > 1;
  const currentCalendarYear = new Date().getFullYear();

  const weeks = useMemo(() => {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    const startDay = startDate.getDay();
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalWeeks = Math.ceil((totalDays + startDay) / 7);
    const cols: { cells: { dateStr: string | null; level: number; perfect: boolean; necessaryFailed: boolean; title: string }[]; anchor: boolean }[] = [];
    let currentDate = new Date(startDate);
    for (let week = 0; week < totalWeeks; week++) {
      const cells: { dateStr: string | null; level: number; perfect: boolean; necessaryFailed: boolean; title: string }[] = [];
      let anchor = false;
      for (let day = 0; day < 7; day++) {
        if ((week === 0 && day < startDay) || currentDate > endDate) {
          cells.push({ dateStr: null, level: 0, perfect: false, necessaryFailed: false, title: '' });
          continue;
        }
        const dateStr = formatDate(currentDate);
        if (year === currentCalendarYear && dateStr === today) anchor = true;
        const { successCount, historicalCount } = getDayCompletionCounts(state.data, catalog, dateStr);
        const necessaryFailed = isDayNecessaryFailed(state.data, catalog, dateStr);
        const level = necessaryFailed ? 0 : heatmapLevel(successCount, historicalCount);
        const perfect = !necessaryFailed && isPerfectHeatmapCell(successCount, historicalCount);
        const title = necessaryFailed
          ? `${dateStr}: necessary task incomplete — day failed`
          : `${dateStr}: ${successCount}/${historicalCount} activities`;
        cells.push({ dateStr, level, perfect, necessaryFailed, title });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      cols.push({ cells, anchor });
    }
    const weekMonths = cols.map((w) => weekColumnMonthFromDates(w.cells.map((c) => c.dateStr)));
    return { cols, weekMonths };
  }, [catalog, state.data, today, year, currentCalendarYear]);

  const monthSpans = heatmapMonthSpans(weeks.weekMonths);

  return (
    <div className="streak-heatmap-container">
      {showNav ? (
        <div className="streak-heatmap-nav">
          <button type="button" className={`streak-nav-btn${year <= Math.min(...years) ? ' streak-nav-btn-disabled' : ''}`} disabled={year <= Math.min(...years)} onClick={() => onYearChange(year - 1)}>‹</button>
          <span className="streak-year-label">{year}</span>
          <button type="button" className={`streak-nav-btn${year >= currentCalendarYear ? ' streak-nav-btn-disabled' : ''}`} disabled={year >= currentCalendarYear} onClick={() => onYearChange(year + 1)}>›</button>
        </div>
      ) : null}
      <div className="streak-heatmap-scroll">
        <div className="streak-heatmap-months" style={{ display: 'flex' }}>
          {monthSpans.map((m) => (
            <span key={m.name} className="streak-heatmap-month" style={{ flex: `0 0 ${(m.weekCount / weeks.cols.length) * 100}%` }}>{m.name}</span>
          ))}
        </div>
        <div className="streak-heatmap-wrapper">
          <div className="streak-heatmap-days">
            {DAY_LABELS.map((d, i) => <span key={i} className="streak-heatmap-day">{d}</span>)}
          </div>
          <div className="streak-heatmap-grid">
            {weeks.cols.map((week, wi) => (
              <div key={wi} className={`streak-heatmap-week${week.anchor ? ' streak-heatmap-scroll-anchor' : ''}`}>
                {week.cells.map((cell, di) => {
                  if (!cell.dateStr) return <div key={di} className="streak-heatmap-cell streak-heatmap-empty" />;
                  if (cell.necessaryFailed) {
                    return (
                      <div
                        key={di}
                        className="streak-heatmap-cell streak-heatmap-necessary-fail"
                        title={cell.title}
                        data-date={cell.dateStr}
                      >
                        <span className="streak-heatmap-fail-x">×</span>
                      </div>
                    );
                  }
                  const style = heatmapColor && cell.level > 0 ? { backgroundColor: hexToRgba(heatmapColor, cell.level * 0.2) } : undefined;
                  return (
                    <div key={di} className={`streak-heatmap-cell streak-heatmap-level-${cell.level}${cell.perfect ? ' streak-heatmap-perfect' : ''}`} title={cell.title} data-date={cell.dateStr} style={style}>
                      {cell.perfect ? <span className="streak-heatmap-check">✓</span> : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StreakWeeklyHeatmap({ state, year, onYearChange }: Props) {
  const weeklyActivities = state.config.activities.filter((a) => a.frequency === 'weekly');
  if (!weeklyActivities.length) return null;
  const years = getWeeklyYearsWithData(state.data, weeklyActivities);
  const showNav = years.length > 1;
  const currentCalendarYear = new Date().getFullYear();
  const today = state.currentDay;
  const jan1 = formatDate(new Date(year, 0, 1));
  const dec31 = formatDate(new Date(year, 11, 31));
  let wStart = getISOWeekStart(jan1);
  const cells: { wStart: string; level: number; perfect: boolean; title: string; current: boolean }[] = [];
  while (wStart <= dec31) {
    const weekDays = getWeekDays(wStart);
    const wEnd = weekDays[6];
    let completedCount = 0;
    let historicalCount = 0;
    for (const activity of weeklyActivities) {
      const startedOn = state.data.activityStartDates[activity.id];
      if (startedOn && startedOn > wEnd) continue;
      historicalCount++;
      const weeklyTarget = activity.weeklyTarget || 1;
      let sessions = 0;
      for (const day of weekDays) {
        if (getLogState(state.data.logs[day]?.[activity.id]) === 'success') sessions++;
      }
      if (sessions >= weeklyTarget) completedCount++;
    }
    const level = heatmapLevel(completedCount, historicalCount);
    cells.push({
      wStart,
      level,
      perfect: isPerfectHeatmapCell(completedCount, historicalCount),
      title: `Week of ${wStart}: ${completedCount}/${historicalCount}`,
      current: year === currentCalendarYear && isDateInWeek(wStart, today)
    });
    const next = parseDate(wStart);
    next.setDate(next.getDate() + 7);
    wStart = formatDate(next);
  }
  const weekMonths = cells.map((c) => weekColumnMonthFromDates([c.wStart]));
  const monthSpans = heatmapMonthSpans(weekMonths);

  return (
    <div className="streak-weekly-heatmap-container">
      {showNav ? (
        <div className="streak-heatmap-nav">
          <button type="button" className={`streak-nav-btn${year <= Math.min(...years) ? ' streak-nav-btn-disabled' : ''}`} disabled={year <= Math.min(...years)} onClick={() => onYearChange(year - 1)}>‹</button>
          <span className="streak-year-label">{year} weekly</span>
          <button type="button" className={`streak-nav-btn${year >= currentCalendarYear ? ' streak-nav-btn-disabled' : ''}`} disabled={year >= currentCalendarYear} onClick={() => onYearChange(year + 1)}>›</button>
        </div>
      ) : null}
      <div className="streak-heatmap-months streak-weekly-months" style={{ display: 'flex' }}>
        {monthSpans.map((m) => (
          <span key={m.name} className="streak-heatmap-month" style={{ flex: `0 0 ${(m.weekCount / cells.length) * 100}%` }}>{m.name}</span>
        ))}
      </div>
      <div className="streak-weekly-heatmap-row">
        {cells.map((cell) => (
          <div
            key={cell.wStart}
            className={`streak-weekly-cell streak-weekly-level-${cell.level}${cell.current ? ' streak-weekly-cell-current' : ''}${cell.perfect ? ' streak-weekly-perfect' : ''}`}
            title={cell.title}
            data-week-start={cell.wStart}
          >
            {cell.perfect ? <span className="streak-weekly-check">✓</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
