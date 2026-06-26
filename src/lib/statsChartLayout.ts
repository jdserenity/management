/** Minimum plot height so Recharts ResponsiveContainer always has a non-zero parent (mobile stack + short viewports). */
export const STATS_CHART_MIN_HEIGHT_PX = 220;

/** Chart column in StatsPeriodExplorer — explicit height when stacked; fill grid cell on lg+. */
export const statsChartShellClass = () =>
  'h-[220px] shrink-0 overflow-visible lg:h-full lg:min-h-0 lg:col-span-3';

/** Outer StatsProgressChart card — h-full on lg; never collapse below min height. */
export const statsProgressChartRootClass = () =>
  'flex h-full min-h-[220px] flex-col overflow-visible rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-4 shadow-inner lg:min-h-0';

/** Plot area inside the card — flex-1 on lg; min height keeps the SVG visible when squeezed. */
export const statsProgressChartPlotClass = () => 'relative min-h-0 flex-1';

export const statsProgressChartPlotStyle = (): { minHeight: number } => ({ minHeight: STATS_CHART_MIN_HEIGHT_PX });
