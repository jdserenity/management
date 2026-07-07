import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  computePostureMetricsFromPoints,
  metricsToLegacyFlags,
  recommendationsForFlags,
  tipKeysFromMetrics,
  type LandmarkRow,
  type PostureMetricsSnapshot,
} from '@/posture/batesPostureScore';
import { MGMT_LS } from '@/lib/mgmtLocalStorage';

const WASM_VERSION = '0.10.35';
const POSE_TASK_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export type PostureAnalysisPayload = {
  turtle_neck: boolean;
  shoulder_misalignment: boolean;
  posture_score: number;
  recommendations: string[];
  confidence: number;
  metrics: PostureMetricsSnapshot;
};

let landmarker: PoseLandmarker | null = null;
let initPromise: Promise<void> | null = null;

function landmarksToRows(landmarks: NormalizedLandmark[]): LandmarkRow {
  return landmarks.map((lm) => [lm.x, lm.y, lm.z] as const);
}

function avgVisibility(landmarks: NormalizedLandmark[], indices: readonly number[]): number {
  let s = 0;
  let n = 0;
  for (const i of indices) {
    const v = landmarks[i]?.visibility;
    if (v != null && !Number.isNaN(v)) {
      s += v;
      n++;
    }
  }
  return n > 0 ? s / n : 0;
}

export function isPoseEngineReady(): boolean {
  return landmarker != null;
}

export async function initPoseLandmarker(): Promise<void> {
  if (landmarker) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${WASM_VERSION}/wasm`,
    );
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: POSE_TASK_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  })();
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

function readSensitivity(): { turtle: 1 | 2 | 3; shoulder: 1 | 2 | 3; poor: number } {
  const t = Number.parseInt(localStorage.getItem(MGMT_LS.turtleNeckSensitivity) || '2', 10);
  const s = Number.parseInt(localStorage.getItem(MGMT_LS.shoulderSensitivity) || '2', 10);
  const turtle = (t === 1 || t === 3 ? t : 2) as 1 | 2 | 3;
  const shoulder = (s === 1 || s === 3 ? s : 2) as 1 | 2 | 3;
  const poor = Number.parseInt(localStorage.getItem(MGMT_LS.poorPostureThreshold) || '60', 10);
  return { turtle, shoulder, poor: Number.isFinite(poor) ? poor : 60 };
}

export function analyzeLandmarks(landmarks: NormalizedLandmark[]): PostureAnalysisPayload | null {
  if (!landmarks?.length) return null;
  const rows = landmarksToRows(landmarks);
  const m = computePostureMetricsFromPoints(rows);
  const { turtle: turtleLv, shoulder: shoulderLv, poor } = readSensitivity();
  const { turtle_neck, shoulder_misalignment } = metricsToLegacyFlags(m, turtleLv, shoulderLv, poor);
  const flagRecs = recommendationsForFlags(turtle_neck, shoulder_misalignment);
  const metricRecs = tipKeysFromMetrics(m);
  let recommendations = [...new Set([...flagRecs.filter((k) => k !== 'motivation.excellent'), ...metricRecs])];
  if (recommendations.length === 0) recommendations = ['motivation.excellent'];
  const confidence = avgVisibility(landmarks, [0, 7, 8, 11, 12, 23, 24]);
  return {
    turtle_neck,
    shoulder_misalignment,
    posture_score: Math.round(m.posture_score),
    recommendations,
    confidence,
    metrics: m,
  };
}

let videoTs = 0;

export async function analyzeDataUrl(dataUrl: string): Promise<PostureAnalysisPayload | null> {
  await initPoseLandmarker();
  if (!landmarker) return null;
  const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    videoTs += 33;
    const res = landmarker.detectForVideo(bmp, videoTs);
    const lm = res.landmarks[0];
    if (!lm?.length) return null;
    return analyzeLandmarks(lm);
  } finally {
    bmp.close();
  }
}
