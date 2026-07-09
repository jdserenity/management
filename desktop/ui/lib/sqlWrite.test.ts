import { describe, expect, it } from 'vitest';
import { sqlFlag, syncNow } from '@/lib/sqlWrite';

describe('sqlWrite helpers', () => {
  it('sqlFlag accepts true/1/"1" only', () => {
    expect(sqlFlag(true)).toBe(true);
    expect(sqlFlag(1)).toBe(true);
    expect(sqlFlag('1')).toBe(true);
    expect(sqlFlag(false)).toBe(false);
    expect(sqlFlag(0)).toBe(false);
    expect(sqlFlag('0')).toBe(false);
    expect(sqlFlag(null)).toBe(false);
    expect(sqlFlag(undefined)).toBe(false);
    expect(sqlFlag('yes')).toBe(false);
  });

  it('syncNow returns an ISO timestamp', () => {
    const t = syncNow();
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(t))).toBe(false);
  });
});
