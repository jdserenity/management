import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generate-icons.mjs');

describe('generate-icons script', () => {
  it('exists and references the brand color', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).toContain('#0000FF');
    expect(source).toContain('tray.png');
    expect(source).toContain('monitoring_off.png');
  });
});
