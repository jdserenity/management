import { describe, expect, it } from 'vitest';
import {
  STATS_CHART_MIN_HEIGHT_PX,
  statsChartShellClass,
  statsProgressChartPlotStyle,
  statsProgressChartRootClass
} from './statsChartLayout';

describe('statsChartLayout', () => {
  it('uses a non-trivial min height so Recharts never gets a zero-height parent', () => {
    expect(STATS_CHART_MIN_HEIGHT_PX).toBeGreaterThanOrEqual(180);
    expect(statsProgressChartPlotStyle().minHeight).toBe(STATS_CHART_MIN_HEIGHT_PX);
  });

  it('gives mobile stacked layout an explicit chart height and lg+ a full-height shell', () => {
    const shell = statsChartShellClass();
    expect(shell).toContain(`h-[${STATS_CHART_MIN_HEIGHT_PX}px]`);
    expect(shell).toContain('shrink-0');
    expect(shell).toContain('lg:h-full');
  });

  it('keeps the chart card from collapsing below min height off large breakpoints', () => {
    const root = statsProgressChartRootClass();
    expect(root).toContain(`min-h-[${STATS_CHART_MIN_HEIGHT_PX}px]`);
    expect(root).toContain('lg:min-h-0');
    expect(root).toContain('h-full');
  });
});
