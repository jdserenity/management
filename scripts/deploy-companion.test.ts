import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'deploy-companion.mjs');

describe('deploy-companion', () => {
  it('imports execSync before use', () => {
    const src = fs.readFileSync(script, 'utf8');
    expect(src).toMatch(/import\s*\{\s*execSync\s*\}\s*from\s*['"]node:child_process['"]/);
    expect(src.indexOf('execSync(')).toBeGreaterThan(src.indexOf('node:child_process'));
  });
});
