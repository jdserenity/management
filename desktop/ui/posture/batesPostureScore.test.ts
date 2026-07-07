import { describe, expect, it } from 'vitest';
import {
  computePostureMetricsFromPoints,
  DEFAULT_POSTURE_WEIGHTS,
  metricsToLegacyFlags,
  PoseLandmarkIndex,
  recommendationsForFlags,
  type LandmarkRow,
} from '@/posture/batesPostureScore';

function uprightRow(): LandmarkRow {
  const rows: [number, number, number][] = Array.from({ length: 33 }, () => [0.5, 0.5, 0]);
  const { NOSE, LEFT_EAR, RIGHT_EAR, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP } = PoseLandmarkIndex;
  rows[NOSE] = [0.5, 0.35, 0];
  rows[LEFT_EAR] = [0.46, 0.38, -0.01];
  rows[RIGHT_EAR] = [0.54, 0.38, 0.01];
  rows[LEFT_SHOULDER] = [0.42, 0.48, 0];
  rows[RIGHT_SHOULDER] = [0.58, 0.48, 0];
  rows[LEFT_HIP] = [0.44, 0.72, 0];
  rows[RIGHT_HIP] = [0.56, 0.72, 0];
  return rows as LandmarkRow;
}

describe('computePostureMetricsFromPoints', () => {
  it('returns a high score for a symmetric upright pose', () => {
    const m = computePostureMetricsFromPoints(uprightRow(), undefined, DEFAULT_POSTURE_WEIGHTS);
    expect(m.posture_score).toBeGreaterThan(70);
    expect(m.neck_angle).toBeLessThan(40);
  });

  it('returns a lower score when shoulders are very uneven', () => {
    const upright = computePostureMetricsFromPoints(uprightRow());
    const rows = uprightRow().map((p) => [...p] as [number, number, number]);
    rows[11] = [0.42, 0.42, 0];
    rows[12] = [0.58, 0.58, 0];
    const tilted = computePostureMetricsFromPoints(rows as LandmarkRow);
    expect(tilted.posture_score).toBeLessThan(upright.posture_score);
    expect(tilted.shoulder_vertical_delta).toBeGreaterThan(0.05);
  });
});

describe('metricsToLegacyFlags', () => {
  it('maps poor neck metrics to turtle_neck', () => {
    const m = {
      posture_score: 40,
      neck_angle: 35,
      shoulder_vertical_delta: 0.01,
      spine_angle: 5,
      head_tilt_score: 0.9,
      neck_vertical_score: 0.2,
      shoulder_level_score: 0.9,
      shoulder_roll_score: 0.9,
      spine_alignment_score: 0.9,
      head_rotation_score: 0.9,
      head_side_tilt_score: 0.9,
    };
    const f = metricsToLegacyFlags(m, 2, 2, 60);
    expect(f.turtle_neck).toBe(true);
  });
});

describe('recommendationsForFlags', () => {
  it('returns motivation when posture is fine', () => {
    expect(recommendationsForFlags(false, false)).toEqual(['motivation.excellent']);
  });
});
