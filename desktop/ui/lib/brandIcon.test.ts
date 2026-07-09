import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_ICON_COLOR, brandAppIconSvg, brandTrayIconSvg, brandTrayMonitoringOffSvg } from './brandIcon';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('brandIcon', () => {
  it('uses the brand blue for the app icon fill', () => {
    expect(BRAND_ICON_COLOR).toBe('#0437F2');
    expect(brandAppIconSvg()).toContain('fill="#0437F2"');
  });

  it('uses a solid black rounded square for the menu bar tray icon (template)', () => {
    const svg = brandTrayIconSvg();
    expect(svg).toContain('fill="#000000"');
    expect(svg).not.toContain('fill-opacity');
    expect(svg).toMatch(/rx="\d+"/);
  });

  it('uses a full-opacity hollow square for monitoring-off (not faded white)', () => {
    const svg = brandTrayMonitoringOffSvg();
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('fill="none"');
    expect(svg).not.toContain('fill-opacity');
  });

  it('ships generated icon assets for desktop and companion', () => {
    for (const rel of [
      'desktop/src-tauri/icons/icon.icns',
      'desktop/src-tauri/icons/icon.png',
      'desktop/src-tauri/icons/tray.png',
      'desktop/src-tauri/icons/monitoring_off.png',
      'mobile/public/icon.svg',
      'mobile/public/apple-touch-icon.png',
      'public/icon.svg'
    ]) {
      expect(fs.existsSync(path.join(root, rel)), rel).toBe(true);
    }
    expect(fs.readFileSync(path.join(root, 'mobile/public/icon.svg'), 'utf8')).toContain(BRAND_ICON_COLOR);
  });
});
