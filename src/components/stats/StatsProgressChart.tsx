import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { periodMoveMinutes, type PeriodStatsPoint } from '@/lib/workoutPlanner';

export type StatsChartRow = PeriodStatsPoint & { label: string; moveMinutes: number };

const FOCUS_COLOR = '#3b82f6';
const MOVE_COLOR = '#fb923c';

/**
 * Y-axis label layout — tweak these if blue/orange numbers overlap or sit too far left.
 * focusLabelX / moveLabelX: horizontal start (px) of each tick column inside the chart margin.
 * yAxisGutter: left margin + axis width reserved for both columns.
 */
export const CHART_Y_AXIS_LAYOUT = {
  focusLabelX: 2,
  moveLabelX: 54,
  yAxisGutter: 68,
  rightMargin: 36
} as const;

type AxisTickProps = { x?: number | string; y?: number | string; payload?: { value: string | number } };

const axisCoord = (v?: number | string): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const FocusAxisTick = (props: AxisTickProps) => {
  const y = axisCoord(props.y); const { payload } = props;
  if (y == null || payload == null) return null;
  return <text x={CHART_Y_AXIS_LAYOUT.focusLabelX} y={y} dy={4} fill="#60a5fa" fontSize={10} textAnchor="start">{payload.value}</text>;
};

const MoveAxisTick = (props: AxisTickProps) => {
  const y = axisCoord(props.y); const { payload } = props;
  if (y == null || payload == null) return null;
  return <text x={CHART_Y_AXIS_LAYOUT.moveLabelX} y={y} dy={4} fill="#fdba74" fontSize={10} textAnchor="start">{payload.value}</text>;
};

type StatsProgressChartProps = {
  data: StatsChartRow[];
  selectedIndex: number;
};

const ChartDot = (props: { cx?: number; cy?: number; index?: number; selectedIndex: number; color: string }) => {
  const { cx, cy, index, selectedIndex, color } = props;
  if (cx == null || cy == null || index == null) return null;
  const selected = index === selectedIndex;
  if (selected) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.35} />
        <circle cx={cx} cy={cy} r={6} fill="#ef4444" />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={4} fill={color} />;
};

const StatsProgressChart = ({ data, selectedIndex }: StatsProgressChartProps) => {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-900/40 px-4 text-sm text-slate-400">
        📉 No history to chart yet
      </div>
    );
  }

  const { yAxisGutter, rightMargin } = CHART_Y_AXIS_LAYOUT;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-visible rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-4 shadow-inner">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <span>📈 Over time</span>
        <span className="normal-case tracking-normal text-blue-400">⏳ Focus</span>
        <span className="normal-case tracking-normal text-orange-400">💪 Move</span>
      </div>
      <div className="min-h-0 flex-1 overflow-visible">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: rightMargin, left: 0, bottom: 4 }} style={{ overflow: 'visible' }}>
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="focus" orientation="left" width={yAxisGutter} tick={FocusAxisTick as never} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis yAxisId="move" orientation="left" width={0} tick={MoveAxisTick as never} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={false}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#f8fafc' }}
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
              name="focusMinutes"
              stroke={FOCUS_COLOR}
              strokeWidth={2.5}
              dot={(dotProps) => <ChartDot {...dotProps} selectedIndex={selectedIndex} color={FOCUS_COLOR} />}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="move"
              type="monotone"
              dataKey="moveMinutes"
              name="moveMinutes"
              stroke={MOVE_COLOR}
              strokeWidth={2.5}
              dot={(dotProps) => <ChartDot {...dotProps} selectedIndex={selectedIndex} color={MOVE_COLOR} />}
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
