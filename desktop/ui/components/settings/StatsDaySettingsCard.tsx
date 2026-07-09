import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDayRolloverHourLabel } from '@/lib/dayBoundary';
import { useSession } from '@/context/SessionContext';

const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: formatDayRolloverHourLabel(hour)
}));

export default function StatsDaySettingsCard() {
  const { dayRolloverHour, setDayRolloverHour } = useSession();

  return (
    <section className="plugin-panel space-y-3">
      <h2 className="plugin-panel-title">Stats day</h2>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="font-medium">Day starts at</span>
            <p className="text-sm plugin-muted">
              Work, movement, nutrition, and habits reset at this time (default 4:00 AM).
            </p>
          </div>
          <Select value={String(dayRolloverHour)} onValueChange={(v) => setDayRolloverHour(Number(v))}>
            <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {hourOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
