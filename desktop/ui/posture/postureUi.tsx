import type { PostureMetricsSnapshot } from '@/posture/batesPostureScore';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';

export const CAMERA_INDEX_KEY = MGMT_LS.cameraIndex;
export const CAMERA_NAME_KEY = MGMT_LS.cameraName;
export const LEGACY_CAMERA_DEVICE_KEY = MGMT_LS.cameraDeviceLegacy;

export const normalizeCameraName = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

export const isValidPreviewFramePayload = (payload: string): boolean =>
  payload.startsWith('data:image/') && payload.includes('base64,') && payload.length > 'data:image/jpeg;base64,'.length;

/** Resolve preferred webcam deviceId from saved prefs / legacy keys. */
export async function resolveSelectedCameraDeviceId(): Promise<string | undefined> {
  if (!navigator.mediaDevices?.enumerateDevices) return undefined;
  const savedIndexRaw = localStorage.getItem(CAMERA_INDEX_KEY);
  const savedCameraName = localStorage.getItem(CAMERA_NAME_KEY);
  const legacyDeviceId = localStorage.getItem(LEGACY_CAMERA_DEVICE_KEY);
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((device) => device.kind === 'videoinput');
  let nextDeviceId: string | undefined;
  if (savedCameraName) {
    const normalizedTarget = normalizeCameraName(savedCameraName);
    const matchedByName =
      normalizedTarget.length > 0
        ? videoInputs.find((device) => {
            const nl = normalizeCameraName(device.label);
            return nl.length > 0 && (nl.includes(normalizedTarget) || normalizedTarget.includes(nl));
          })
        : undefined;
    if (matchedByName) nextDeviceId = matchedByName.deviceId;
  }
  if (!nextDeviceId && legacyDeviceId && videoInputs.some((d) => d.deviceId === legacyDeviceId)) {
    nextDeviceId = legacyDeviceId;
  }
  if (savedIndexRaw !== null) {
    const parsedIndex = Number.parseInt(savedIndexRaw, 10);
    if (!nextDeviceId && !Number.isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < videoInputs.length) {
      nextDeviceId = videoInputs[parsedIndex].deviceId;
    }
  }
  if (!nextDeviceId && videoInputs.length > 0) nextDeviceId = videoInputs[0].deviceId;
  if (nextDeviceId) localStorage.setItem(LEGACY_CAMERA_DEVICE_KEY, nextDeviceId);
  return nextDeviceId;
}

export function MetricBars({ m }: { m: PostureMetricsSnapshot }) {
  const rows: { label: string; v: number }[] = [
    { label: 'Head tilt (depth)', v: m.head_tilt_score },
    { label: 'Neck vs vertical', v: m.neck_vertical_score },
    { label: 'Shoulder level', v: m.shoulder_level_score },
    { label: 'Shoulder roll (depth)', v: m.shoulder_roll_score },
    { label: 'Spine alignment', v: m.spine_alignment_score },
    { label: 'Head rotation', v: m.head_rotation_score },
    { label: 'Head side tilt', v: m.head_side_tilt_score }
  ];
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
            <span>{row.label}</span>
            <span className="tabular-nums">{Math.round(row.v * 100)}%</span>
          </div>
          <div className="plugin-progress mt-0">
            <div className="plugin-progress-fill" style={{ width: `${Math.round(row.v * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
