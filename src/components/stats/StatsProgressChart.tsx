import { useRef, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { periodMoveMinutes, type PeriodStatsPoint } from '@/lib/workoutPlanner';

export type StatsChartRow = PeriodStatsPoint & { label: string; moveMinutes: number };

const FOCUS_COLOR = '#3b82f6';
const MOVE_COLOR = '#fb923c';
const TOOLTIP_WIDTH = 176;
const TOOLTIP_HEIGHT = 74;
const TOOLTIP_MARGIN = 10;

type StatsProgressChartProps = {
  data: StatsChartRow[];
  selectedIndex: number;
};

type DotCoord = { x: number; focusY?: number; moveY?: number };

const StatsProgressChart = ({ data, selectedIndex }: StatsProgressChartProps) => {
  const coordsRef = useRef<Record<number, DotCoord>>({});
  const chartAreaRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-900/40 px-4 text-sm text-slate-400">
        📉 No history to chart yet
      </div>
    );
  }

  const recordCoord = (index: number, key: 'focusY' | 'moveY', x: number, y: number) => {
    const cur = coordsRef.current[index] ?? { x };
    cur.x = x; cur[key] = y; coordsRef.current[index] = cur;
  };

  const renderDot = (color: string, key: 'focusY' | 'moveY') =>
    (props: { cx?: number; cy?: number; index?: number }) => {
      const { cx, cy, index } = props;
      if (cx == null || cy == null || index == null) return <g />;
      recordCoord(index, key, cx, cy);
      const selected = index === selectedIndex;
      const hovered = index === hoverIndex;
      if (selected) {
        const r = hovered ? 7 : 6;
        return (
          <g>
            <circle cx={cx} cy={cy} r={r + 6} fill="#ffffff" opacity={0.25} />
            <circle cx={cx} cy={cy} r={r} fill="#ffffff" />
          </g>
        );
      }
      const r = hovered ? 6 : 3;
      return <circle cx={cx} cy={cy} r={r} fill={color} />;
    };

  const hovered = hoverIndex != null ? data[hoverIndex] : null;
  const hoveredCoord = hoverIndex != null ? coordsRef.current[hoverIndex] : null;
  const tooltipX = hoveredCoord?.x ?? 0;
  const tooltipY = Math.min(hoveredCoord?.focusY ?? Infinity, hoveredCoord?.moveY ?? Infinity);
  const showTooltip = hovered != null && Number.isFinite(tooltipY);
  const chartHeight = chartAreaRef.current?.clientHeight ?? 0;
  const preferAboveTop = tooltipY - TOOLTIP_MARGIN - TOOLTIP_HEIGHT;
  const preferBelowTop = tooltipY + TOOLTIP_MARGIN;
  const rawTooltipTop = preferAboveTop >= 4 ? preferAboveTop : preferBelowTop;
  const tooltipTop = chartHeight > 0
    ? Math.max(4, Math.min(rawTooltipTop, chartHeight - TOOLTIP_HEIGHT - 4))
    : rawTooltipTop;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-visible rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-4 shadow-inner">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <span>📈 Over time</span>
        <span className="normal-case tracking-normal text-blue-400">⏳ Focus</span>
        <span className="normal-case tracking-normal text-orange-400">💪 Move</span>
      </div>
      <div ref={chartAreaRef} className="relative min-h-0 flex-1 overflow-visible">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 16, right: 28, left: 0, bottom: 4 }}
            style={{ overflow: 'visible' }}
            onMouseMove={(state) => {
              const idx = Number((state as { activeTooltipIndex?: unknown } | undefined)?.activeTooltipIndex);
              setHoverIndex(Number.isInteger(idx) ? idx : null);
            }}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="focus" orientation="left" width={34} tick={{ fill: '#60a5fa', fontSize: 10 }} axisLine={false} tickLine={false} tickMargin={4} allowDecimals={false} />
            <YAxis yAxisId="move" orientation="left" width={34} tick={{ fill: '#fdba74', fontSize: 10 }} axisLine={false} tickLine={false} tickMargin={4} allowDecimals={false} />
            <Line
              yAxisId="focus"
              type="monotone"
              dataKey="focusMinutes"
              stroke={FOCUS_COLOR}
              strokeWidth={2.5}
              dot={renderDot(FOCUS_COLOR, 'focusY')}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="move"
              type="monotone"
              dataKey="moveMinutes"
              stroke={MOVE_COLOR}
              strokeWidth={2.5}
              dot={renderDot(MOVE_COLOR, 'moveY')}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>

        {showTooltip && hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-lg"
            style={{ left: tooltipX - TOOLTIP_WIDTH / 2, top: tooltipTop, width: TOOLTIP_WIDTH, height: TOOLTIP_HEIGHT }}
          >
            <p className="mb-1 truncate font-semibold text-slate-300">{hovered.label}</p>
            <p className="text-blue-400">⏳ Focus: {hovered.focusMinutes} min</p>
            <p className="text-orange-400">💪 Move: {hovered.moveMinutes} min</p>
          </div>
        )}
      </div>
    </div>
  );
};

export const toChartRows = (points: PeriodStatsPoint[], labelFor: (bucket: string) => string): StatsChartRow[] =>
  points.map((point) => ({ ...point, label: labelFor(point.bucket), moveMinutes: periodMoveMinutes(point) }));

export default StatsProgressChart;
