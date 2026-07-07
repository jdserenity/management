import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';
import { openSystemSettings } from '@/lib/systemSettingsLinks';

interface CameraDetail {
  index: number;
  name: string;
}

const CAMERA_INDEX_KEY = MGMT_LS.cameraIndex;
const CAMERA_NAME_KEY = MGMT_LS.cameraName;
const LEGACY_CAMERA_DEVICE_KEY = MGMT_LS.cameraDeviceLegacy;

const normalizeCameraName = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

export default function PostureCameraSettingsCard() {
  const { t } = useTranslation();
  const [cameras, setCameras] = useState<CameraDetail[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState<string>(() => localStorage.getItem(CAMERA_INDEX_KEY) || '0');

  const syncPreviewCameraDevice = useCallback(async (cameraName: string, fallbackIndex: number) => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');
      if (videoInputs.length === 0) return;
      const normalizedTarget = normalizeCameraName(cameraName);
      const matchedByName = normalizedTarget
        ? videoInputs.find((device) => {
          const normalizedLabel = normalizeCameraName(device.label);
          return normalizedLabel.length > 0 && (normalizedLabel.includes(normalizedTarget) || normalizedTarget.includes(normalizedLabel));
        })
        : undefined;
      const matchedByIndex = Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < videoInputs.length
        ? videoInputs[fallbackIndex]
        : videoInputs[0];
      const resolvedDeviceId = (matchedByName ?? matchedByIndex)?.deviceId;
      if (resolvedDeviceId) localStorage.setItem(LEGACY_CAMERA_DEVICE_KEY, resolvedDeviceId);
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
        console.error(t('settings.cameraErrorGetList', 'Failed to fetch camera list:'), error);
      }
    };
    void getCamerasFromBackend();
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
      .catch((e) => console.error(t('settings.cameraErrorSetSelected', 'Failed to set camera:'), e));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.cameraTitle', 'Camera')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('settings.cameraGuide', 'If the camera does not work, allow Management in system camera settings.')}{' '}
          <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => void openSystemSettings('camera')}>
            {t('settings.cameraGoTo', 'Open camera settings')}
          </Button>
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium">{t('settings.cameraSelect', 'Camera for posture analysis')}</span>
          <Select value={selectedCameraIndex} onValueChange={handleCameraChange} disabled={cameras.length === 0}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder={cameras.length === 0 ? t('settings.cameraNone', 'No camera found') : t('settings.cameraSelectPlaceholder', 'Choose a camera')} />
            </SelectTrigger>
            <SelectContent>
              {cameras.map((camera) => (
                <SelectItem key={camera.index} value={camera.index.toString()}>{camera.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
