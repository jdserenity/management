import { useState, useEffect, type ReactNode } from 'react';
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

  const monitoringOptions = batterySavingMode
    ? ['3', '5', '10', '15', '30'].map((v) => ({ value: v, label: `${v}m` }))
    : ['3', '5', '7', '10', '15'].map((v) => ({ value: v, label: `${v}s` }));

  const handleBatterySavingToggle = (checked: boolean) => {
    setBatterySavingMode(checked);
    localStorage.setItem(BATTERY_SAVING_MODE_KEY, checked.toString());
    if (checked) setFrequency('1');
  };

  return (
    <Card>
      <CardHeader><CardTitle>Posture detection</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="font-medium">Battery saving mode</span>
            <p className="text-sm text-muted-foreground">Uses minute-based monitoring intervals and a lighter camera mode.</p>
          </div>
          <Switch checked={batterySavingMode} onCheckedChange={handleBatterySavingToggle} />
        </div>
        <SettingRow label="Monitoring interval" desc="How often posture is analyzed.">
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
          label="Alert sensitivity"
          desc={batterySavingMode ? 'Fixed to 1 detection in battery saving mode.' : 'How many of the last 3 bad detections trigger an alert.'}
        >
          <Select value={frequency} onValueChange={setFrequency} disabled={batterySavingMode}>
            <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 (sensitive)</SelectItem>
              <SelectItem value="2">2 (normal)</SelectItem>
              <SelectItem value="3">3 (relaxed)</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Forward head sensitivity" desc="How strictly forward-head posture is flagged.">
          <SensitivitySelect value={turtleNeckSensitivity} onValueChange={setTurtleNeckSensitivity} />
        </SettingRow>
        <SettingRow label="Shoulder alignment sensitivity" desc="How strictly shoulder asymmetry is flagged.">
          <SensitivitySelect value={shoulderSensitivity} onValueChange={setShoulderSensitivity} />
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

function SensitivitySelect({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="1">Loose</SelectItem>
        <SelectItem value="2">Normal</SelectItem>
        <SelectItem value="3">Strict</SelectItem>
      </SelectContent>
    </Select>
  );
}
