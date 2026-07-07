import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { invoke } from '@tauri-apps/api/core';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';

const NOTIFICATION_FREQUENCY_KEY = MGMT_LS.notificationFrequency;
const TURTLE_NECK_SENSITIVITY_KEY = MGMT_LS.turtleNeckSensitivity;
const SHOULDER_SENSITIVITY_KEY = MGMT_LS.shoulderSensitivity;
const MONITORING_INTERVAL_KEY = MGMT_LS.monitoringInterval;
const BATTERY_SAVING_MODE_KEY = MGMT_LS.batterySavingMode;

export default function PostureDetectionSettingsCard() {
  const { t } = useTranslation();
  const [batterySavingMode, setBatterySavingMode] = useState(() => localStorage.getItem(BATTERY_SAVING_MODE_KEY) === 'true');
  const [frequency, setFrequency] = useState<string>(() => localStorage.getItem(NOTIFICATION_FREQUENCY_KEY) || '2');
  const [turtleNeckSensitivity, setTurtleNeckSensitivity] = useState<string>(() => localStorage.getItem(TURTLE_NECK_SENSITIVITY_KEY) || '2');
  const [shoulderSensitivity, setShoulderSensitivity] = useState<string>(() => localStorage.getItem(SHOULDER_SENSITIVITY_KEY) || '2');
  const [monitoringInterval, setMonitoringInterval] = useState<string>(() => localStorage.getItem(MONITORING_INTERVAL_KEY) || '3');

  useEffect(() => {
    invoke('set_battery_saving_mode', { mode: batterySavingMode }).catch(console.error);
  }, [batterySavingMode]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_FREQUENCY_KEY, frequency);
    localStorage.setItem(TURTLE_NECK_SENSITIVITY_KEY, turtleNeckSensitivity);
    localStorage.setItem(SHOULDER_SENSITIVITY_KEY, shoulderSensitivity);
    localStorage.setItem(MONITORING_INTERVAL_KEY, monitoringInterval);
    invoke('set_detection_settings', {
      frequency: batterySavingMode ? 1 : parseInt(frequency, 10),
      turtleSensitivity: parseInt(turtleNeckSensitivity, 10),
      shoulderSensitivity: parseInt(shoulderSensitivity, 10)
    }).catch(console.error);
    if (batterySavingMode) {
      invoke('set_monitoring_interval', { intervalMins: parseInt(monitoringInterval, 10) }).catch(console.error);
    } else {
      invoke('set_monitoring_interval', { intervalSecs: parseInt(monitoringInterval, 10) }).catch(console.error);
    }
  }, [frequency, turtleNeckSensitivity, shoulderSensitivity, monitoringInterval, batterySavingMode]);

  const monitoringOptions = batterySavingMode ? [
    { value: '3', label: t('settings.interval3m', '3m') },
    { value: '5', label: t('settings.interval5m', '5m') },
    { value: '10', label: t('settings.interval10m', '10m') },
    { value: '15', label: t('settings.interval15m', '15m') },
    { value: '30', label: t('settings.interval30m', '30m') }
  ] : [
    { value: '3', label: t('settings.interval3s', '3s') },
    { value: '5', label: t('settings.interval5s', '5s') },
    { value: '7', label: t('settings.interval7s', '7s') },
    { value: '10', label: t('settings.interval10s', '10s') },
    { value: '15', label: t('settings.interval15s', '15s') }
  ];

  const handleBatterySavingToggle = (checked: boolean) => {
    setBatterySavingMode(checked);
    localStorage.setItem(BATTERY_SAVING_MODE_KEY, checked.toString());
    if (checked) setFrequency('1');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.detectionTitle', 'Posture detection')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-medium">{t('settings.batterySavingMode', 'Battery saving mode')}</span>
            <p className="text-sm text-muted-foreground">
              {t('settings.batterySavingModeDesc', 'Uses minute-based monitoring intervals and a lighter camera mode.')}
            </p>
          </div>
          <Switch checked={batterySavingMode} onCheckedChange={handleBatterySavingToggle} />
        </div>
        <SettingRow
          label={t('settings.monitoringInterval', 'Monitoring interval')}
          desc={t('settings.monitoringIntervalDesc', 'How often posture is analyzed.')}
        >
          <Select value={monitoringInterval} onValueChange={setMonitoringInterval}>
            <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monitoringOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label={t('settings.notificationFrequency', 'Alert sensitivity')}
          desc={batterySavingMode
            ? t('settings.notificationFrequencyDescBatterySaving', 'Fixed to 1 detection in battery saving mode.')
            : t('settings.notificationFrequencyDescNormal', 'How many of the last 3 bad detections trigger an alert.')}
        >
          <Select value={frequency} onValueChange={setFrequency} disabled={batterySavingMode}>
            <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t('settings.frequencyOnce', '1 (sensitive)')}</SelectItem>
              <SelectItem value="2">{t('settings.frequencyTwice', '2 (normal)')}</SelectItem>
              <SelectItem value="3">{t('settings.frequencyThrice', '3 (relaxed)')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label={t('settings.turtleNeckSensitivity', 'Forward head sensitivity')}
          desc={t('settings.turtleNeckSensitivityDesc', 'How strictly forward-head posture is flagged.')}
        >
          <SensitivitySelect value={turtleNeckSensitivity} onValueChange={setTurtleNeckSensitivity} t={t} />
        </SettingRow>
        <SettingRow
          label={t('settings.shoulderSensitivity', 'Shoulder alignment sensitivity')}
          desc={t('settings.shoulderSensitivityDesc', 'How strictly shoulder asymmetry is flagged.')}
        >
          <SensitivitySelect value={shoulderSensitivity} onValueChange={setShoulderSensitivity} t={t} />
        </SettingRow>
      </CardContent>
    </Card>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <span className="font-medium">{label}</span>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function SensitivitySelect({ value, onValueChange, t }: { value: string; onValueChange: (v: string) => void; t: (k: string, d: string) => string }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="1">{t('settings.sensitivityLoose', 'Loose')}</SelectItem>
        <SelectItem value="2">{t('settings.sensitivityNormal', 'Normal')}</SelectItem>
        <SelectItem value="3">{t('settings.sensitivityStrict', 'Strict')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
