import { describe, expect, it } from 'vitest';
import {
  FEATURE_POSTURE,
  FEATURE_WORK,
  isNavFeatureEnabled,
  shouldRestoreActiveFlow,
  shouldRunFocusFlow,
  shouldRunPostureRuntime
} from './features';

describe('features', () => {
  it('parks work and posture', () => {
    expect(FEATURE_WORK).toBe(false);
    expect(FEATURE_POSTURE).toBe(false);
  });

  it('isNavFeatureEnabled follows the switches', () => {
    expect(isNavFeatureEnabled('work')).toBe(FEATURE_WORK);
    expect(isNavFeatureEnabled('posture')).toBe(FEATURE_POSTURE);
    expect(isNavFeatureEnabled('daily')).toBe(true);
    expect(isNavFeatureEnabled('stats')).toBe(true);
    expect(isNavFeatureEnabled('customize')).toBe(true);
    expect(isNavFeatureEnabled('settings')).toBe(true);
  });

  it('shouldRunFocusFlow matches FEATURE_WORK', () => {
    expect(shouldRunFocusFlow()).toBe(FEATURE_WORK);
  });

  it('shouldRunPostureRuntime matches FEATURE_POSTURE', () => {
    expect(shouldRunPostureRuntime()).toBe(FEATURE_POSTURE);
  });

  it('does not restore a focus flow while Work is parked', () => {
    expect(shouldRestoreActiveFlow(true)).toBe(FEATURE_WORK);
    expect(shouldRestoreActiveFlow(false)).toBe(false);
  });
});
