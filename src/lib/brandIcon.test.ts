import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_ICON_COLOR, brandAppIconSvg, brandTrayIconSvg } from './brandIcon';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('brandIcon', () => {
  it('uses cobalt blue for the app icon fill', () => {
    expect(BRAND_ICON_COLOR).toBe('#0047AB');
    expect(brandAppIconSvg()).toContain('fill="#0047AB"');
  });

  it('uses a white rounded square for the menu bar tray icon', () => {
    const svg = brandTrayIconSvg();
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).toMatch(/rx="\d+"/);
  });

  it('ships generated icon assets for desktop and companion', () => {
    for (const rel of [
      'src-tauri/icons/icon.icns',
      'src-tauri/icons/icon.png',
      'src-tauri/icons/tray.png',
      'src-tauri/icons/monitoring_off.png',
      'apps/companion/public/icon.svg',
      'apps/companion/public/apple-touch-icon.png',
      'public/icon.svg'
    ]) {
      expect(fs.existsSync(path.join(root, rel)), rel).toBe(true);
    }
    expect(fs.readFileSync(path.join(root, 'apps/companion/public/icon.svg'), 'utf8')).toContain(BRAND_ICON_COLOR);
  });
});
