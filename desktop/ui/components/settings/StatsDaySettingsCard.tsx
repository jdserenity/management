import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDayRolloverHourLabel } from '@/lib/dayBoundary';
import { useSession } from '@/context/SessionContext';

const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: formatDayRolloverHourLabel(hour)
}));

export default function StatsDaySettingsCard() {
  const { t } = useTranslation();
  const { dayRolloverHour, setDayRolloverHour } = useSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.statsDayTitle', 'Stats day')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="font-medium">{t('settings.statsDayRollover', 'Day starts at')}</span>
            <p className="text-sm text-muted-foreground">
              {t('settings.statsDayRolloverDesc', 'Work, movement, nutrition, and habits reset at this time (default 4:00 AM).')}
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
      </CardContent>
    </Card>
  );
}
