import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./App.css', import.meta.url), 'utf8');

describe('companion PWA zoom', () => {
  it('viewport forbids pinch zoom and double-tap zoom scaling', () => {
    expect(html).toContain('maximum-scale=1');
    expect(html).toContain('user-scalable=no');
  });

  it('touch handling allows scrolling and carousel pans but not pinch-zoom', () => {
    expect(css).toContain('touch-action: pan-x pan-y');
    expect(css).not.toContain('pinch-zoom');
  });
});
