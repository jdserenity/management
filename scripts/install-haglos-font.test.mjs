import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(root, 'scripts/install-haglos-font.mjs');

describe('install-haglos-font script', () => {
  it('exists and targets Haglos-Regular.otf under desktop/ui/assets/fonts', () => {
    const src = fs.readFileSync(scriptPath, 'utf8');
    expect(src).toContain('Haglos-Regular.otf');
    expect(src).toContain('desktop/ui/assets/fonts');
  });
});
