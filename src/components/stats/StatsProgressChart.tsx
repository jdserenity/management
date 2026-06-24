import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { periodChartValue, type PeriodStatsPoint } from '@/lib/workoutPlanner';

export type StatsChartRow = PeriodStatsPoint & { label: string; chartValue: number };

type StatsProgressChartProps = {
  data: StatsChartRow[];
  selectedIndex: number;
};

const ChartDot = (props: { cx?: number; cy?: number; index?: number; selectedIndex: number }) => {
  const { cx, cy, index, selectedIndex } = props;
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
      <circle cx={cx} cy={cy} r={selected ? 7 : 4} fill={selected ? '#ef4444' : '#3b82f6'} stroke="#f8fafc" strokeWidth={selected ? 2.5 : 1.5} />
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">📈 Active minutes over time</p>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <radialGradient id="statsDotGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </radialGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#f8fafc' }}
              labelStyle={{ color: '#cbd5e1', marginBottom: 4 }}
              formatter={(value) => [`${value} min`, '⚡ Active']}
            />
            <Line
              type="monotone"
              dataKey="chartValue"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={(dotProps) => <ChartDot {...dotProps} selectedIndex={selectedIndex} />}
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
  points.map((point) => ({ ...point, label: labelFor(point.bucket), chartValue: periodChartValue(point) }));

export default StatsProgressChart;
