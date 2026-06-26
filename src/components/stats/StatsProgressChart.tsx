import { useRef, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { periodMoveMinutes, type PeriodStatsPoint } from '@/lib/workoutPlanner';
import { STATS_CHART_MIN_HEIGHT_PX, statsProgressChartPlotClass, statsProgressChartPlotStyle, statsProgressChartRootClass } from '@/lib/statsChartLayout';

export type StatsChartRow = PeriodStatsPoint & { label: string; moveMinutes: number };

const FOCUS_COLOR = '#3b82f6';
const MOVE_COLOR = '#fb923c';
const TOOLTIP_WIDTH = 176;
const TOOLTIP_HEIGHT = 74;

type StatsProgressChartProps = {
  data: StatsChartRow[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
};
type DotCoord = { x: number; focusY?: number; moveY?: number };

const StatsProgressChart = ({ data, selectedIndex, onSelectIndex }: StatsProgressChartProps) => {
  const coordsRef = useRef<Record<number, DotCoord>>({});
  const chartAreaRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | undefined>(undefined);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-900/40 px-4 text-sm text-slate-400" style={{ minHeight: STATS_CHART_MIN_HEIGHT_PX }}>
        📉 No history to chart yet
      </div>
    );
  }

  const renderDot = (color: string, key: 'focusY' | 'moveY') =>
    (props: { cx?: number; cy?: number; index?: number }) => {
      const { cx, cy, index } = props;
      if (cx == null || cy == null || index == null) return <g />;
      const cur = coordsRef.current[index] ?? { x: cx };
      cur.x = cx; cur[key] = cy; coordsRef.current[index] = cur;
      const selected = index === selectedIndex;
      const hovered = index === hoverIndex;
      if (selected) {
        const r = hovered ? 7 : 6;
        return (
          <g className="cursor-pointer" onClick={() => onSelectIndex(index)}>
            <circle cx={cx} cy={cy} r={r + 6} fill="#ffffff" opacity={0.25} />
            <circle cx={cx} cy={cy} r={r} fill="#ffffff" />
          </g>
        );
      }
      const r = hovered ? 6 : 3;
      return <circle cx={cx} cy={cy} r={r} fill={color} className="cursor-pointer" onClick={() => onSelectIndex(index)} />;
    };

  return (
    <div className={statsProgressChartRootClass()}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <span>📈 Over time</span>
        <span className="normal-case tracking-normal text-blue-400">⏳ Focus</span>
        <span className="normal-case tracking-normal text-orange-400">💪 Move</span>
      </div>
      <div ref={chartAreaRef} className={statsProgressChartPlotClass()} style={statsProgressChartPlotStyle()}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 16, right: 28, left: 0, bottom: 4 }}
            style={{ overflow: 'visible' }}
            onMouseMove={(state) => {
              const idx = Number((state as { activeTooltipIndex?: unknown } | undefined)?.activeTooltipIndex);
              if (!Number.isInteger(idx)) {
                setHoverIndex(null); setTooltipPosition(undefined); return;
              }
              setHoverIndex(idx);
              const chart = chartAreaRef.current;
              const point = coordsRef.current[idx];
              if (!chart || !point) return;
              const chartW = chart.clientWidth;
              const chartH = chart.clientHeight;
              const spaceLeft = point.x - 4;
              const spaceRight = chartW - point.x - 4;
              const anchorY = Math.min(point.focusY ?? Infinity, point.moveY ?? Infinity);
              const placeRight = spaceRight >= TOOLTIP_WIDTH + 12 || spaceRight >= spaceLeft;
              const rawX = placeRight ? point.x + 12 : point.x - TOOLTIP_WIDTH - 12;
              const x = Math.max(4, Math.min(rawX, chartW - TOOLTIP_WIDTH - 4));
              const spaceAbove = anchorY - 4;
              const spaceBelow = chartH - anchorY - 4;
              const aboveY = anchorY - TOOLTIP_HEIGHT - 10;
              const belowY = anchorY + 10;
              const placeAbove = spaceAbove >= TOOLTIP_HEIGHT + 10 || spaceAbove >= spaceBelow;
              const preferredY = placeAbove ? aboveY : belowY;
              const y = Math.max(4, Math.min(preferredY, chartH - TOOLTIP_HEIGHT - 4));
              setTooltipPosition({ x, y });
            }}
            onMouseLeave={() => {
              setHoverIndex(null);
              setTooltipPosition(undefined);
            }}
          >
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="focus" orientation="left" width={34} tick={{ fill: '#60a5fa', fontSize: 10 }} axisLine={false} tickLine={false} tickMargin={4} allowDecimals={false} />
            <YAxis yAxisId="move" orientation="left" width={34} tick={{ fill: '#fdba74', fontSize: 10 }} axisLine={false} tickLine={false} tickMargin={4} allowDecimals={false} />
            <Tooltip
              cursor={false}
              isAnimationActive={false}
              offset={12}
              position={tooltipPosition}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#f8fafc', width: TOOLTIP_WIDTH, minHeight: TOOLTIP_HEIGHT }}
              labelStyle={{ color: '#cbd5e1', marginBottom: 4 }}
              formatter={(value, name) => {
                const mins = typeof value === 'number' ? value : Number(value);
                if (name === 'focusMinutes') return [`${mins} min`, '⏳ Focus'];
                if (name === 'moveMinutes') return [`${mins} min`, '💪 Move'];
                return [value, name];
              }}
            />
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
      </div>
    </div>
  );
};

export const toChartRows = (points: PeriodStatsPoint[], labelFor: (bucket: string) => string): StatsChartRow[] =>
  points.map((point) => ({ ...point, label: labelFor(point.bucket), moveMinutes: periodMoveMinutes(point) }));

export default StatsProgressChart;
