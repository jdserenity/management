import { describe, expect, it } from 'vitest';
import { normalizeApiUrl } from './apiUrl';

describe('normalizeApiUrl', () => {
  it('returns undefined for empty input', () => {
    expect(normalizeApiUrl()).toBeUndefined();
    expect(normalizeApiUrl('')).toBeUndefined();
    expect(normalizeApiUrl('   ')).toBeUndefined();
  });

  it('keeps https URLs and strips trailing slash', () => {
    expect(normalizeApiUrl('https://mgmt.levier.cc/')).toBe('https://mgmt.levier.cc');
  });

  it('prefixes bare host:port with http://', () => {
    expect(normalizeApiUrl('100.93.97.83:8787')).toBe('http://100.93.97.83:8787');
  });
});
