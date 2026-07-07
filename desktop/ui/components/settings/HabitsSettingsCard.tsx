import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadStreakHeatmapColorPref, saveStreakHeatmapColorPref } from '@/lib/streakHeatmapPref';

export default function HabitsSettingsCard() {
  const { t } = useTranslation();
  const [heatmapColor, setHeatmapColor] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadStreakHeatmapColorPref()
      .then((color) => {
        setHeatmapColor(color ?? '#22c55e');
        setLoaded(true);
      })
      .catch(console.error);
  }, []);

  const persistColor = useCallback((hex: string) => {
    const normalized = hex.trim();
    setHeatmapColor(normalized);
    void saveStreakHeatmapColorPref(normalized || null).catch(console.error);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.habitsTitle', 'Habits')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="font-medium">{t('settings.habitsHeatmapColor', 'Daily heatmap color')}</span>
            <p className="text-sm text-muted-foreground">
              {t('settings.habitsHeatmapColorDesc', 'Custom color for the yearly habits heatmap. Weekly heatmap stays red.')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-10 w-14 cursor-pointer rounded border border-border bg-background p-1"
              value={loaded ? heatmapColor : '#22c55e'}
              disabled={!loaded}
              onChange={(e) => persistColor(e.target.value)}
            />
            <input
              type="text"
              className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm"
              value={heatmapColor}
              disabled={!loaded}
              onChange={(e) => setHeatmapColor(e.target.value)}
              onBlur={() => persistColor(heatmapColor)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
