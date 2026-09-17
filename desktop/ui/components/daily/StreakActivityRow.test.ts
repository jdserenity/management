import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'streak.css');

describe('expanded Daily activity titles', () => {
  it('allows mobile titles to wrap to their full height', () => {
    const css = fs.readFileSync(cssPath, 'utf8');
    const expandedRule = css.match(/\.streak-activity-name\.streak-activity-name-wrap\s*\{([^}]*)\}/)?.[1] || '';

    expect(expandedRule).toContain('white-space: normal');
    expect(expandedRule).toContain('overflow: visible');
    expect(expandedRule).toContain('display: block');
    expect(expandedRule).not.toContain('-webkit-line-clamp');
  });
});
