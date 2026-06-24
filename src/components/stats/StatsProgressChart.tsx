import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { periodMoveMinutes, type PeriodStatsPoint } from '@/lib/workoutPlanner';

export type StatsChartRow = PeriodStatsPoint & { label: string; moveMinutes: number };

const FOCUS_COLOR = '#3b82f6';
const MOVE_COLOR = '#fb923c';

type StatsProgressChartProps = {
  data: StatsChartRow[];
  selectedIndex: number;
};

const ChartDot = (props: { cx?: number; cy?: number; index?: number; selectedIndex: number; color: string }) => {
  const { cx, cy, index, selectedIndex, color } = props;
  if (cx == null || cy == null || index == null) return null;
  const selected = index === selectedIndex;
  return (
    <g>
      {selected && (
        <>
          <circle cx={cx} cy={cy} r={18} fill="url(#statsDotGlow)" opacity={0.9} />
          <circle cx={cx} cy={cy} r={11} fill="none" stroke="#f87171" strokeWidth={2} opacity={0.55} />
        </>
      )}
      <circle cx={cx} cy={cy} r={selected ? 7 : 4} fill={selected ? '#ef4444' : color} stroke="#f8fafc" strokeWidth={selected ? 2.5 : 1.5} />
    </g>
  );
};

const StatsProgressChart = ({ data, selectedIndex }: StatsProgressChartProps) => {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-900/40 px-4 text-sm text-slate-400">
        📉 No history to chart yet
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[220px] flex-col rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-4 shadow-inner">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
        <span>📈 Over time</span>
        <span className="normal-case tracking-normal text-blue-400">⏳ Focus</span>
        <span className="normal-case tracking-normal text-orange-400">💪 Move</span>
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <radialGradient id="statsDotGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </radialGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis yAxisId="focus" orientation="left" tick={{ fill: '#60a5fa', fontSize: 10 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
            <YAxis yAxisId="move" orientation="left" tick={{ fill: '#fdba74', fontSize: 10 }} axisLine={false} tickLine={false} width={28} dx={-32} allowDecimals={false} />
            <Tooltip
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
