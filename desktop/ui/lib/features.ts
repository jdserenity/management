/** Build-time switches. Flip to `true` and rebuild to restore a parked feature. */
export const FEATURE_WORK = false;
export const FEATURE_POSTURE = false;

export const isNavFeatureEnabled = (id: string): boolean => {
  if (id === 'work') return FEATURE_WORK;
  if (id === 'posture') return FEATURE_POSTURE;
  return true;
};

export const shouldRunFocusFlow = (): boolean => FEATURE_WORK;

export const shouldRunPostureRuntime = (): boolean => FEATURE_POSTURE;

export const shouldRestoreActiveFlow = (resumable: boolean): boolean => FEATURE_WORK && resumable;
