import { describe, expect, it } from 'vitest';
import { LATEST_SCHEMA_VERSION, SCHEMA_MIGRATIONS } from './migrations';

describe('SCHEMA_MIGRATIONS', () => {
  it('has contiguous versions through the latest schema', () => {
    const versions = SCHEMA_MIGRATIONS.map((m) => m.version);
    expect(LATEST_SCHEMA_VERSION).toBe(9);
    expect(versions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('includes water tracker and streak cross-log migrations', () => {
    expect(SCHEMA_MIGRATIONS.find((m) => m.version === 8)?.description).toBe('water_tracker_tables');
    expect(SCHEMA_MIGRATIONS.find((m) => m.version === 9)?.description).toBe('streak_activity_cross_log_columns');
  });
});
