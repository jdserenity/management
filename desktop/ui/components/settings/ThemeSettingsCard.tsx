import { useTheme } from 'next-themes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ThemeSettingsCard() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="plugin-panel space-y-3">
      <h2 className="plugin-panel-title">Theme</h2>
      <div>
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
