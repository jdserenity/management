/**
 * Posture metrics adapted from BatesPosture (MIT) pose_detector.py — same landmark
 * topology as MediaPipe Pose (33 points, normalized x/y/z).
 * @see https://github.com/wtbates99/batesposture
 */

export const DEFAULT_POSTURE_WEIGHTS = [0.2, 0.2, 0.15, 0.15, 0.15, 0.1, 0.05] as const;

export const DEFAULT_POSTURE_THRESHOLDS: Record<string, number> = {
  head_tilt: 1.2,
  neck_angle: 45.0,
  shoulder_level: 5.0,
  shoulder_roll: 2.0,
  spine_angle: 45.0,
};

/** MediaPipe Pose landmark indices (33-landmark BlazePose topology). */
export const PoseLandmarkIndex = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

export type Vec3 = readonly [number, number, number];

export type LandmarkRow = readonly Vec3[];

function angleBetweenDegrees(v1: readonly number[], v2: readonly number[]): number {
  const n1 = Math.hypot(v1[0], v1[1], v1[2] || 0);
  const n2 = Math.hypot(v2[0], v2[1], v2[2] || 0);
  if (n1 < 1e-6 || n2 < 1e-6) return 0;
  const d = Math.min(1, Math.max(-1, (v1[0] * v2[0] + v1[1] * v2[1] + (v1[2] || 0) * (v2[2] || 0)) / (n1 * n2)));
  return (Math.acos(d) * 180) / Math.PI;
}

function clip(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function normalizeWeights(raw: readonly number[]): number[] {
  const coerced = raw.map((v) => Number(v));
  if (coerced.length !== DEFAULT_POSTURE_WEIGHTS.length) {
    return [...DEFAULT_POSTURE_WEIGHTS];
  }
  if (coerced.some((v) => v < 0)) return [...DEFAULT_POSTURE_WEIGHTS];
  const t = coerced.reduce((a, b) => a + b, 0);
  if (t <= 0) return [...DEFAULT_POSTURE_WEIGHTS];
  return coerced.map((v) => v / t);
}

export function computePostureMetricsFromPoints(
  points: LandmarkRow,
  thresholds: Record<string, number> = DEFAULT_POSTURE_THRESHOLDS,
  weightsInput: readonly number[] = DEFAULT_POSTURE_WEIGHTS,
): {
  posture_score: number;
  neck_angle: number;
  shoulder_vertical_delta: number;
  spine_angle: number;
  head_tilt_score: number;
  neck_vertical_score: number;
  shoulder_level_score: number;
  shoulder_roll_score: number;
  spine_alignment_score: number;
  head_rotation_score: number;
  head_side_tilt_score: number;
} {
  const { NOSE, LEFT_EAR, RIGHT_EAR, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP } = PoseLandmarkIndex;
  const nose = points[NOSE];
  const ears: Vec3[] = [points[LEFT_EAR], points[RIGHT_EAR]];
  const shoulders: Vec3[] = [points[LEFT_SHOULDER], points[RIGHT_SHOULDER]];
  const hips: Vec3[] = [points[LEFT_HIP], points[RIGHT_HIP]];

  const midEar: Vec3 = [(ears[0][0] + ears[1][0]) / 2, (ears[0][1] + ears[1][1]) / 2, (ears[0][2] + ears[1][2]) / 2];
  const midShoulder: Vec3 = [
    (shoulders[0][0] + shoulders[1][0]) / 2,
    (shoulders[0][1] + shoulders[1][1]) / 2,
    (shoulders[0][2] + shoulders[1][2]) / 2,
  ];
  const midHip: Vec3 = [(hips[0][0] + hips[1][0]) / 2, (hips[0][1] + hips[1][1]) / 2, (hips[0][2] + hips[1][2]) / 2];

  const idealNeck = [0, -1, 0];
  const idealSpine = [0, -1, 0];

  const headTiltScore = clip(1 - Math.abs((nose[2] || 0) - (midEar[2] || 0)) * thresholds.head_tilt, 0, 1);
  const neckVec = [midEar[0] - midShoulder[0], midEar[1] - midShoulder[1], (midEar[2] || 0) - (midShoulder[2] || 0)];
  const neckAngle = angleBetweenDegrees(neckVec, idealNeck);
  const neckVerticalScore = clip(1 - Math.abs(neckAngle) / thresholds.neck_angle, 0, 1);

  const shoulderDiff = [shoulders[0][0] - shoulders[1][0], shoulders[0][1] - shoulders[1][1], (shoulders[0][2] || 0) - (shoulders[1][2] || 0)];
  const shoulderLevelScore = clip(1 - Math.abs(shoulderDiff[1]) * thresholds.shoulder_level, 0, 1);
  const shoulderRollScore = clip(1 - Math.abs(shoulderDiff[2] || 0) * thresholds.shoulder_roll, 0, 1);

  const spineVec = [midShoulder[0] - midHip[0], midShoulder[1] - midHip[1], (midShoulder[2] || 0) - (midHip[2] || 0)];
  const spineAngle = angleBetweenDegrees(spineVec, idealSpine);
  const spineAlignmentScore = clip(1 - Math.abs(spineAngle) / thresholds.spine_angle, 0, 1);

  const earDistance = Math.hypot(ears[1][0] - ears[0][0], ears[1][1] - ears[0][1], (ears[1][2] || 0) - (ears[0][2] || 0));
  const shoulderWidth = Math.hypot(shoulders[1][0] - shoulders[0][0], shoulders[1][1] - shoulders[0][1], (shoulders[1][2] || 0) - (shoulders[0][2] || 0));
  const idealEarDistance = shoulderWidth * 0.7;
  const headRotationScore = clip(1 - Math.abs(earDistance - idealEarDistance) / (idealEarDistance + 1e-6), 0, 1);
  const headSideTiltScore = clip(1 - Math.abs(ears[0][1] - ears[1][1]) * 5, 0, 1);

  const scores = [headTiltScore, neckVerticalScore, shoulderLevelScore, shoulderRollScore, spineAlignmentScore, headRotationScore, headSideTiltScore];
  const weights = normalizeWeights(weightsInput);
  let postureScore = 0;
  for (let i = 0; i < scores.length; i++) postureScore += scores[i] * (weights[i] ?? 0);
  postureScore = clip(postureScore * 100, 0, 100);

  return {
    posture_score: postureScore,
    neck_angle: neckAngle,
    shoulder_vertical_delta: Math.abs(shoulderDiff[1]),
    spine_angle: spineAngle,
    head_tilt_score: headTiltScore,
    neck_vertical_score: neckVerticalScore,
    shoulder_level_score: shoulderLevelScore,
    shoulder_roll_score: shoulderRollScore,
    spine_alignment_score: spineAlignmentScore,
    head_rotation_score: headRotationScore,
    head_side_tilt_score: headSideTiltScore,
  };
}

export type PostureMetricsSnapshot = ReturnType<typeof computePostureMetricsFromPoints>;

/** Suggest tips from the weakest geometric components (complements debounced alerts). */
export function tipKeysFromMetrics(m: PostureMetricsSnapshot): string[] {
  const tips: string[] = [];
  if (m.neck_vertical_score < 0.55 || m.neck_angle > 20) tips.push('tip1', 'tip2');
  if (m.shoulder_level_score < 0.55 || m.shoulder_roll_score < 0.55) tips.push('tip4', 'tip5');
  if (m.spine_alignment_score < 0.55) tips.push('tip3', 'tip4');
  if (m.head_tilt_score < 0.55 || m.head_side_tilt_score < 0.55) tips.push('tip2');
  return [...new Set(tips)].slice(0, 5);
}

/** Map Bates-style metrics to legacy turtle / shoulder flags for DB + UI. */
export function metricsToLegacyFlags(
  m: ReturnType<typeof computePostureMetricsFromPoints>,
  turtleSensitivity: 1 | 2 | 3,
  shoulderSensitivity: 1 | 2 | 3,
  poorPostureThreshold = 60,
): { turtle_neck: boolean; shoulder_misalignment: boolean } {
  const neckAngleCut = turtleSensitivity === 1 ? 26 : turtleSensitivity === 3 ? 16 : 21;
  const neckScoreCut = turtleSensitivity === 1 ? 0.38 : turtleSensitivity === 3 ? 0.55 : 0.45;
  const shoulderLevelCut = shoulderSensitivity === 1 ? 0.42 : shoulderSensitivity === 3 ? 0.58 : 0.5;
  const turtle =
    m.posture_score < poorPostureThreshold - 5 || m.neck_angle > neckAngleCut || m.neck_vertical_score < neckScoreCut;
  const shoulder =
    m.posture_score < poorPostureThreshold - 5 || m.shoulder_level_score < shoulderLevelCut || m.shoulder_roll_score < 0.45;
  return { turtle_neck: turtle, shoulder_misalignment: shoulder };
}

export function recommendationsForFlags(turtle: boolean, shoulder: boolean): string[] {
  const recommendations: string[] = [];
  if (turtle) {
    recommendations.push('tip1');
    recommendations.push('tip2');
  }
  if (shoulder) {
    recommendations.push('tip4');
    recommendations.push('tip5');
  }
  if (recommendations.length === 0) recommendations.push('motivation.excellent');
  return recommendations;
}
