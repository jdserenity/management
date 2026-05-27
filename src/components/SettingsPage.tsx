import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Command, open } from '@tauri-apps/plugin-shell';
import { platform } from '@tauri-apps/plugin-os';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { useTheme } from 'next-themes';

import { MGMT_LS } from '@/lib/mgmtLocalStorage';
import { formatDayRolloverHourLabel } from '@/lib/dayBoundary';
import { useSession } from '@/context/SessionContext';
import {
  getAppPresenceModePref,
  setAppPresenceModePref,
  type AppPresenceMode,
} from '@/lib/appPresencePref';
import {
  loadSessionAlertsPrefs,
  notifySessionAlertsPrefsChanged,
  saveSessionAlertsPref,
  type SessionAlertsPrefs,
} from '@/lib/sessionAlertsPref';

const NOTIFICATION_FREQUENCY_KEY = MGMT_LS.notificationFrequency;
const TURTLE_NECK_SENSITIVITY_KEY = MGMT_LS.turtleNeckSensitivity;
const SHOULDER_SENSITIVITY_KEY = MGMT_LS.shoulderSensitivity;
const CAMERA_INDEX_KEY = MGMT_LS.cameraIndex;
const CAMERA_NAME_KEY = MGMT_LS.cameraName;
const LEGACY_CAMERA_DEVICE_KEY = MGMT_LS.cameraDeviceLegacy;
const MONITORING_INTERVAL_KEY = MGMT_LS.monitoringInterval;
const BATTERY_SAVING_MODE_KEY = MGMT_LS.batterySavingMode;

// --- Type Definitions ---
interface CameraDetail {
    index: number;
    name: string;
}

const normalizeCameraName = (value: string): string =>
    value.toLowerCase().replace(/\s+/g, ' ').trim();

// --- Components ---

const DetectionSettings = () => {
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
            shoulderSensitivity: parseInt(shoulderSensitivity, 10),
        }).catch(console.error);

        if (batterySavingMode) {
            invoke('set_monitoring_interval', {
                intervalMins: parseInt(monitoringInterval, 10),
            }).catch(console.error);
        } else {
            invoke('set_monitoring_interval', {
                intervalSecs: parseInt(monitoringInterval, 10),
            }).catch(console.error);
        }

    }, [frequency, turtleNeckSensitivity, shoulderSensitivity, monitoringInterval, batterySavingMode]);

    const monitoringOptions = batterySavingMode ? [
        { value: '3', label: t('settings.interval3m', '3분') },
        { value: '5', label: t('settings.interval5m', '5분') },
        { value: '10', label: t('settings.interval10m', '10분') },
        { value: '15', label: t('settings.interval15m', '15분') },
        { value: '30', label: t('settings.interval30m', '30분') },
    ] : [
        { value: '3', label: t('settings.interval3s', '3초') },
        { value: '5', label: t('settings.interval5s', '5초') },
        { value: '7', label: t('settings.interval7s', '7초') },
        { value: '10', label: t('settings.interval10s', '10초') },
        { value: '15', label: t('settings.interval15s', '15초') },
    ];

    const handleBatterySavingToggle = (checked: boolean) => {
        setBatterySavingMode(checked);
        localStorage.setItem(BATTERY_SAVING_MODE_KEY, checked.toString());
        if (checked) {
            setFrequency('1');
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.detectionTitle', '감지 및 알림 설정')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.batterySavingMode', '배터리 절약 모드')}</span>
                        <p className="text-sm text-muted-foreground">{t('settings.batterySavingModeDesc', '활성화 시 모니터링 주기를 분단위로 변경하고 카메라를 절약 모드로 운영합니다.')}</p>
                    </div>
                    <Switch checked={batterySavingMode} onCheckedChange={handleBatterySavingToggle} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.monitoringInterval', '모니터링 주기')}</span>
                        <p className="text-sm text-muted-foreground">{t('settings.monitoringIntervalDesc', '자세를 분석하는 시간 간격을 설정합니다.')}</p>
                    </div>
                    <Select value={monitoringInterval} onValueChange={setMonitoringInterval}>
                        <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {monitoringOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.notificationFrequency', '알림 빈도')}</span>
                        <p className="text-sm text-muted-foreground">{batterySavingMode ? t('settings.notificationFrequencyDescBatterySaving', '배터리 절약 모드에서는 1번으로 고정됩니다.') : t('settings.notificationFrequencyDescNormal', '최근 3번의 감지 중 몇 번 이상 나쁜 자세가 감지되면 알림을 받을지 설정합니다.')}</p>
                    </div>
                    <Select value={frequency} onValueChange={setFrequency} disabled={batterySavingMode}>
                        <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">{t('settings.frequencyOnce', '1번 (민감)')}</SelectItem>
                            <SelectItem value="2">{t('settings.frequencyTwice', '2번 (보통)')}</SelectItem>
                            <SelectItem value="3">{t('settings.frequencyThrice', '3번 (둔감)')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.turtleNeckSensitivity', '거북목 감지 강도')}</span>
                        <p className="text-sm text-muted-foreground">{t('settings.turtleNeckSensitivityDesc', '거북목 자세를 얼마나 엄격하게 감지할지 설정합니다.')}</p>
                    </div>
                    <Select value={turtleNeckSensitivity} onValueChange={setTurtleNeckSensitivity}>
                        <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">{t('settings.sensitivityLoose', '느슨하게')}</SelectItem>
                            <SelectItem value="2">{t('settings.sensitivityNormal', '보통')}</SelectItem>
                            <SelectItem value="3">{t('settings.sensitivityStrict', '엄격하게')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.shoulderSensitivity', '어깨 정렬 감지 강도')}</span>
                        <p className="text-sm text-muted-foreground">{t('settings.shoulderSensitivityDesc', '어깨 비대칭을 얼마나 엄격하게 감지할지 설정합니다.')}</p>
                    </div>
                    <Select value={shoulderSensitivity} onValueChange={setShoulderSensitivity}>
                        <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">{t('settings.sensitivityLoose', '느슨하게')}</SelectItem>
                            <SelectItem value="2">{t('settings.sensitivityNormal', '보통')}</SelectItem>
                            <SelectItem value="3">{t('settings.sensitivityStrict', '엄격하게')}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
};

const CameraSettings = () => {
    const { t } = useTranslation();
    const [cameras, setCameras] = useState<CameraDetail[]>([]);
    const [selectedCameraIndex, setSelectedCameraIndex] = useState<string>(
        () => localStorage.getItem(CAMERA_INDEX_KEY) || '0'
    );

    const syncPreviewCameraDevice = useCallback(async (cameraName: string, fallbackIndex: number) => {
        if (!navigator.mediaDevices?.enumerateDevices) {
            return;
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter((device) => device.kind === 'videoinput');

            if (videoInputs.length === 0) {
                return;
            }

            const normalizedTarget = normalizeCameraName(cameraName);
            const matchedByName = normalizedTarget
                ? videoInputs.find((device) => {
                    const normalizedLabel = normalizeCameraName(device.label);
                    return normalizedLabel.length > 0 && (
                        normalizedLabel.includes(normalizedTarget)
                        || normalizedTarget.includes(normalizedLabel)
                    );
                })
                : undefined;

            const matchedByIndex = Number.isInteger(fallbackIndex)
                && fallbackIndex >= 0
                && fallbackIndex < videoInputs.length
                ? videoInputs[fallbackIndex]
                : videoInputs[0];

            const resolvedDeviceId = (matchedByName ?? matchedByIndex)?.deviceId;
            if (resolvedDeviceId) {
                localStorage.setItem(LEGACY_CAMERA_DEVICE_KEY, resolvedDeviceId);
            }
        } catch (error) {
            console.error('Failed to sync preview camera device:', error);
        }
    }, []);

    useEffect(() => {
        const getCamerasFromBackend = async () => {
            try {
                const availableCameras = await invoke<CameraDetail[]>('get_available_cameras');
                setCameras(availableCameras);

                const savedIndex = localStorage.getItem(CAMERA_INDEX_KEY) || '0';
                const hasSavedCamera = availableCameras.some((cam) => cam.index.toString() === savedIndex);
                const resolvedIndex = hasSavedCamera
                    ? savedIndex
                    : availableCameras.length > 0
                        ? availableCameras[0].index.toString()
                        : '0';

                setSelectedCameraIndex(resolvedIndex);
                localStorage.setItem(CAMERA_INDEX_KEY, resolvedIndex);

                const selectedCamera = availableCameras.find((cam) => cam.index.toString() === resolvedIndex);
                if (selectedCamera) {
                    localStorage.setItem(CAMERA_NAME_KEY, selectedCamera.name);
                    await syncPreviewCameraDevice(selectedCamera.name, selectedCamera.index);
                }

            } catch (error) {
                console.error(t('settings.cameraErrorGetList', 'Failed to fetch camera list from backend:'), error);
            }
        };

        getCamerasFromBackend();
    }, [syncPreviewCameraDevice, t]);

    const handleCameraChange = (value: string) => {
        const newIndex = parseInt(value, 10);
        setSelectedCameraIndex(value);
        localStorage.setItem(CAMERA_INDEX_KEY, value);

        const selectedCamera = cameras.find((camera) => camera.index === newIndex);
        if (selectedCamera) {
            localStorage.setItem(CAMERA_NAME_KEY, selectedCamera.name);
            void syncPreviewCameraDevice(selectedCamera.name, selectedCamera.index);
        }

        invoke('set_selected_camera', { index: newIndex })
            .catch(e => console.error(t('settings.cameraErrorSetSelected', 'Failed to set selected camera in backend:'), e));
    };

    const openCameraSettings = async () => {
        try {
            const osPlatform = await platform();
            if (osPlatform === 'macos') {
                await Command.create('open-settings', ["x-apple.systempreferences:com.apple.preference.security?Privacy_Camera"]).execute();
            } else if (osPlatform === 'windows') {
                await open('ms-settings:privacy-webcam');
            } else if (osPlatform === 'linux') {
                alert(
                    t(
                        'settings.cameraPermissionLinux',
                        'Linux may not provide a direct camera permission window for this app. Close other apps using the webcam, restart Management, and re-select the camera. If you use Flatpak or Snap, also verify portal/sandbox camera permissions.'
                    )
                );
            } else {
                alert(t('settings.cameraPermissionDirect', '시스템 설정 > 개인 정보 보호 및 보안 > 카메라에서 앱 권한을 직접 허용해주세요.'));
            }
        } catch (error) {
            console.error(t('settings.settingsErrorOpen', 'Failed to open settings window:'), error);
            alert(t('settings.cameraPermissionManual', '설정 창을 열 수 없습니다. 수동으로 시스템 설정 > 개인 정보 보호 및 보안 > 카메라로 이동하여 권한을 확인해주세요.'));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.cameraTitle', '카메라 설정')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-200">
                    <p>{t('settings.cameraGuide', '카메라가 작동하지 않는 경우, 아래 버튼을 클릭하여 시스템 설정에서 앱의 카메라 접근 권한을 허용해주세요.')}</p>
                    <Button onClick={openCameraSettings} className="mt-2">
                        {t('settings.cameraGoTo', '카메라 설정으로 이동')}
                    </Button>
                </div>

                <div className="flex items-center justify-between">
                    <span className="font-medium">{t('settings.cameraSelect', '분석에 사용할 카메라')}</span>
                    <Select value={selectedCameraIndex} onValueChange={handleCameraChange} disabled={cameras.length === 0}>
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder={cameras.length === 0 ? t('settings.cameraNone', '사용 가능한 카메라 없음') : t('settings.cameraSelectPlaceholder', '카메라를 선택하세요')} />
                        </SelectTrigger>
                        <SelectContent>
                            {cameras.map((camera) => (
                                <SelectItem key={camera.index} value={camera.index.toString()}>
                                    {camera.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>
    );
};


const UpdateSettings = () => {
    const { t } = useTranslation();
    const [isChecking, setIsChecking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [updateInfo, setUpdateInfo] = useState<{ version: string; date: string } | null>(null);
    const [installed, setInstalled] = useState(false);

    const checkForUpdates = async () => {
        try {
            setIsChecking(true);
            setProgress(0);
            setUpdateInfo(null);
            setInstalled(false);

            const update = await check();

            if (update) {
                setUpdateInfo({ version: update.version || '', date: update.date || '' });
                setIsChecking(false);
                setIsDownloading(true);

                let downloaded = 0;
                let contentLength = 0;

                await update.downloadAndInstall((event) => {
                    switch (event.event) {
                        case 'Started': {
                            contentLength = event.data.contentLength || 0;
                            console.log(`started downloading ${event.data.contentLength} bytes`);
                            break;
                        }
                        case 'Progress': {
                            downloaded += event.data.chunkLength;
                            const currentProgress = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
                            setProgress(Math.round(currentProgress));
                            console.log(`downloaded ${downloaded} from ${contentLength}`);
                            break;
                        }
                        case 'Finished': {
                            console.log('download finished');
                            setIsDownloading(false);
                            setIsInstalling(true);
                            break;
                        }
                    }
                });

                setIsInstalling(false);
                setInstalled(true);
            } else {
                setIsChecking(false);
            }
        } catch (error) {
            console.error(t('settings.updateErrorCheck', 'Update check failed:'), error);
            setIsChecking(false);
            setIsDownloading(false);
            setIsInstalling(false);
        }
    };

    const handleRestart = async () => {
        try {
            await invoke('restart_app');
        } catch (error) {
            console.error(t('settings.appErrorRestart', 'Failed to restart app:'), error);
            alert(t('settings.appRestartManual', '앱을 수동으로 재시작해주세요.'));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.updateTitle', '업데이트 설정')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 border-l-4 border-green-400 text-green-800 dark:bg-green-900 dark:border-green-600 dark:text-green-200">
                    <p>{t('settings.updateGuide', '새로운 버전이 있는지 확인하고 자동으로 업데이트를 설치합니다.')}</p>
                    <Button
                        onClick={checkForUpdates}
                        disabled={isChecking || isDownloading || isInstalling}
                        className="mt-2"
                    >
                        {isChecking ? t('settings.checkingUpdate', '업데이트 확인 중...') : t('settings.checkUpdate', '업데이트 확인')}
                    </Button>

                    {updateInfo && (
                        <p className="mt-2 text-sm">
                            {t('settings.updateFound', '업데이트 발견: {{version}} ({{date}})', { version: updateInfo.version, date: updateInfo.date })}
                        </p>
                    )}

                    {isDownloading && (
                        <div className="mt-4">
                            <p className="text-sm mb-2">{t('settings.updateDownloading', '다운로드 중... {{progress}}%', { progress })}</p>
                            <Progress value={progress} className="w-full" />
                        </div>
                    )}

                    {isInstalling && (
                        <p className="mt-2 text-sm">{t('settings.updateInstalling', '설치 중...')}</p>
                    )}

                    {installed && (
                        <div className="mt-4">
                            <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                                {t('settings.updateInstalled', '업데이트 설치 완료. 앱을 재시작해주세요.')}
                            </p>
                            <Button onClick={handleRestart} variant="outline">
                                {t('settings.restartApp', '앱 재시작')}
                            </Button>
                        </div>
                    )}

                    {!isChecking && !isDownloading && !isInstalling && !installed && !updateInfo && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            {t('settings.upToDate', '최신 버전입니다.')}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const StatsDaySettings = () => {
    const { t } = useTranslation();
    const { dayRolloverHour, setDayRolloverHour } = useSession();
    const hourOptions = Array.from({ length: 24 }, (_, hour) => ({
        value: String(hour),
        label: formatDayRolloverHourLabel(hour)
    }));

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
                            {t('settings.statsDayRolloverDesc', 'Today’s work and movement totals reset at this time (default 4:00 AM).')}
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
};

const AppPresenceSettings = () => {
    const { t } = useTranslation();
    const [menuBarOnly, setMenuBarOnly] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        getAppPresenceModePref()
            .then((mode) => {
                setMenuBarOnly(mode === 'menu_bar');
                setLoaded(true);
            })
            .catch(console.error);
    }, []);

    const applyMode = useCallback(async (mode: AppPresenceMode) => {
        await setAppPresenceModePref(mode);
        await invoke('set_app_presence_mode', { mode });
    }, []);

    const handleToggle = (checked: boolean) => {
        const mode: AppPresenceMode = checked ? 'menu_bar' : 'dock';
        setMenuBarOnly(checked);
        applyMode(mode).catch(console.error);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.appPresenceTitle', 'App icon location')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.menuBarOnly', 'Menu bar only')}</span>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'settings.menuBarOnlyDesc',
                                'Off: Management appears in the Dock and App Switcher (normal app). On: icon stays in the menu bar; closing the window hides the app instead of quitting.'
                            )}
                        </p>
                    </div>
                    <Switch
                        checked={menuBarOnly}
                        onCheckedChange={handleToggle}
                        disabled={!loaded}
                        aria-label={t('settings.menuBarOnly', 'Menu bar only')}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

const SessionAlertSettings = () => {
    const { t } = useTranslation();
    const [prefs, setPrefs] = useState<SessionAlertsPrefs | null>(null);

    useEffect(() => {
        loadSessionAlertsPrefs()
            .then(setPrefs)
            .catch(console.error);
    }, []);

    const patch = (key: keyof SessionAlertsPrefs, value: boolean) => {
        if (!prefs) return;
        const next = { ...prefs, [key]: value };
        setPrefs(next);
        saveSessionAlertsPref(key, value)
            .then(() => {
                if (key === 'trayTimer') void invoke('set_session_tray_timer_enabled', { enabled: value }).catch(console.error);
                notifySessionAlertsPrefsChanged();
            })
            .catch(console.error);
    };

    if (!prefs) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.sessionAlertsTitle', 'Focus & break alerts')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.sessionSound', 'Sound alerts')}</span>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.sessionSoundDesc', 'Play a short chime when a focus or break phase starts or the flow ends.')}
                        </p>
                    </div>
                    <Switch checked={prefs.sound} onCheckedChange={(v) => patch('sound', v)} />
                </div>
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.sessionCountdownSound', '5-second countdown')}</span>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.sessionCountdownSoundDesc', 'Tick each second during the last 5 seconds before a phase ends.')}
                        </p>
                    </div>
                    <Switch checked={prefs.countdownSound} onCheckedChange={(v) => patch('countdownSound', v)} />
                </div>
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.sessionFocusWindow', 'Bring app to front')}</span>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.sessionFocusWindowDesc', 'Show and focus the window when a phase changes.')}
                        </p>
                    </div>
                    <Switch checked={prefs.focusWindow} onCheckedChange={(v) => patch('focusWindow', v)} />
                </div>
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.sessionDockBounce', 'Bounce Dock icon')}</span>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'settings.sessionDockBounceDesc',
                                'When bringing the app to front, also bounce the Dock icon (macOS). Requires Bring app to front.'
                            )}
                        </p>
                    </div>
                    <Switch
                        checked={prefs.dockBounce}
                        onCheckedChange={(v) => patch('dockBounce', v)}
                        disabled={!prefs.focusWindow}
                    />
                </div>
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.sessionNotify', 'System notifications')}</span>
                        <p className="text-sm text-muted-foreground">
                            {t('settings.sessionNotifyDesc', 'Desktop notification when focus, break, or relax phases start.')}
                        </p>
                    </div>
                    <Switch checked={prefs.notify} onCheckedChange={(v) => patch('notify', v)} />
                </div>
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="font-medium">{t('settings.sessionTrayTimer', 'Menu bar timer')}</span>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'settings.sessionTrayTimerDesc',
                                'Keep the Dock icon and also show a menu bar icon with a live countdown (e.g. P 24:59). macOS only for the text timer.'
                            )}
                        </p>
                    </div>
                    <Switch checked={prefs.trayTimer} onCheckedChange={(v) => patch('trayTimer', v)} />
                </div>
            </CardContent>
        </Card>
    );
};

const ThemeSettings = () => {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();

    const handleThemeChange = (value: string) => {
        setTheme(value);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.themeTitle', '테마 설정')}</CardTitle>
            </CardHeader>
            <CardContent>
                <Select value={theme} onValueChange={handleThemeChange}>
                    <SelectTrigger className="w-[250px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="light">{t('settings.themeLight', '밝은 테마')}</SelectItem>
                        <SelectItem value="dark">{t('settings.themeDark', '어두운 테마')}</SelectItem>
                        <SelectItem value="system">{t('settings.themeSystem', '시스템 설정')}</SelectItem>
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
    );
};

const NotificationSettings = () => {
    const { t } = useTranslation();

    const openNotificationSettings = async () => {
        try {
            const osPlatform = await platform();
            if (osPlatform === 'macos') {
                await Command.create('open-settings', ["x-apple.systempreferences:com.apple.preference.notifications"]).execute();
            } else if (osPlatform === 'windows') {
                await open('ms-settings:notifications');
            } else {
                alert(t('settings.notificationPermissionDirect', '시스템 설정 > 알림에서 앱의 알림 권한을 직접 허용해주세요.'));
            }
        } catch (error) {
            console.error(t('settings.notificationErrorOpen', 'Failed to open notification settings:'), error);
            alert(t('settings.notificationPermissionManual', '설정 창을 열 수 없습니다. 수동으로 시스템 설정 > 알림으로 이동하여 권한을 확인해주세요.'));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('settings.notificationTitle', '시스템 알림 설정')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-200">
                    <p>{t('settings.notificationGuide', '알림이 오지 않는 경우, 아래 버튼을 클릭하여 시스템 설정에서 앱의 알림 권한을 허용해주세요.')}</p>
                    <Button onClick={openNotificationSettings} className="mt-2">
                        {t('settings.notificationGoTo', '알림 설정으로 이동')}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

const SettingsPage = () => {
    return (
        <div className="space-y-6 p-4 md:p-6">
            <AppPresenceSettings />
            <SessionAlertSettings />
            <ThemeSettings />
            <StatsDaySettings />
            <DetectionSettings />
            <CameraSettings />
            <NotificationSettings />
            <UpdateSettings />
        </div>
    );
};

export default SettingsPage;
