// src/components/daily/StreakHeatmaps.tsx

import { useMemo } from 'react';
import { buildActivityCatalog } from '@/lib/streak/activityCatalog';
import { getDayCompletionCounts, getCalendarMonthsWithData, getMonthCalendarDates, isDayComplete } from '@/lib/streak/heatmap';
import type { StreakState } from '@/lib/streak/types';

type Props = {
  state: StreakState;
  month: string;
  onMonthChange: (month: string) => void;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StreakMonthlyCalendar({ state, month, onMonthChange }: Props) {
  const catalog = useMemo(() => buildActivityCatalog(state.config, state.data), [state]);
  const currentMonth = state.currentDay.slice(0, 7);
  const months = useMemo(() => getCalendarMonthsWithData(state.data, currentMonth), [currentMonth, state.data]);
  const monthDates = useMemo(() => getMonthCalendarDates(month), [month]);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${month}-02T12:00:00`));
  const monthIndex = months.indexOf(month);
  const canGoPrevious = monthIndex > 0;
  const canGoNext = monthIndex >= 0 && monthIndex < months.length - 1 && month < currentMonth;

  return (
    <div className="streak-calendar-container" aria-label="Unbroken chain calendar">
      <div className="streak-heatmap-nav">
        <button type="button" className={`streak-nav-btn${canGoPrevious ? '' : ' streak-nav-btn-disabled'}`} disabled={!canGoPrevious} onClick={() => onMonthChange(months[monthIndex - 1])}>‹</button>
        <span className="streak-calendar-label">{monthLabel}</span>
        <button type="button" className={`streak-nav-btn${canGoNext ? '' : ' streak-nav-btn-disabled'}`} disabled={!canGoNext} onClick={() => onMonthChange(months[monthIndex + 1])}>›</button>
      </div>
      <div className="streak-calendar-weekdays" aria-hidden="true">
        {DAY_LABELS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="streak-calendar-grid">
        {monthDates.map((dateStr, index) => {
          if (!dateStr) return <div key={index} className="streak-calendar-day streak-calendar-day-empty" aria-hidden="true" />;
          const { successCount, historicalCount } = getDayCompletionCounts(state.data, catalog, dateStr);
          const complete = isDayComplete(state.data, catalog, dateStr);
          const dayNumber = Number(dateStr.slice(8, 10));
          const title = historicalCount > 0
            ? `${dateStr}: ${successCount}/${historicalCount} activities${complete ? ' — complete' : ''}`
            : `${dateStr}: no scheduled activities`;
          return (
            <div key={dateStr} className={`streak-calendar-day${complete ? ' streak-calendar-day-complete' : ''}${dateStr === state.currentDay ? ' streak-calendar-day-current' : ''}`} title={title} data-date={dateStr}>
              <span className="streak-calendar-day-number">{dayNumber}</span>
              {complete ? <span className="streak-calendar-x" aria-label="Complete">X</span> : null}
            </div>
          );
        })}
      </div>
      <p className="streak-calendar-caption">Unbroken chain: X means every task due that day was completed.</p>
    </div>
  );
}
