import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ThemeSettingsCard() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.themeTitle', 'Theme')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="light">{t('settings.themeLight', 'Light')}</SelectItem>
            <SelectItem value="dark">{t('settings.themeDark', 'Dark')}</SelectItem>
            <SelectItem value="system">{t('settings.themeSystem', 'System')}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
