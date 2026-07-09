import { describe, expect, it } from 'vitest';
import { useAppDataLoad, useFeatureFileRefresh } from '@/lib/useAppDataLoad';

describe('useAppDataLoad exports', () => {
  it('exposes load hook and feature-file alias', () => {
    expect(typeof useAppDataLoad).toBe('function');
    expect(typeof useFeatureFileRefresh).toBe('function');
  });
});
