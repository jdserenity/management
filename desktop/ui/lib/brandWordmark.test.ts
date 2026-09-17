import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BrandWordmark from '@/components/daily/BrandWordmark';
import { BRAND_WORDMARK_COLOR, BRAND_WORDMARK_FONT, BRAND_WORDMARK_TEXT } from './brandWordmark';
import { brandWordmarkFontPath } from './brandWordmarkFontPath';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cssPath = path.join(root, 'desktop/ui/components/daily/brandWordmark.css');

describe('brandWordmark', () => {
  it('uses Management in Haglos', () => {
    expect(BRAND_WORDMARK_TEXT).toBe('Management');
    expect(BRAND_WORDMARK_FONT).toBe('"Haglos", cursive');
    expect(BRAND_WORDMARK_COLOR).toBe('var(--foreground)');
  });

  it('declares Haglos @font-face with system local() before bundled OTF', () => {
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).toContain("font-family: 'Haglos'");
    expect(css).toContain("local('Haglos')");
    expect(css).toContain('Haglos-Regular.otf');
    expect(css).toContain('font-display: swap');
  });

  it('uses the theme foreground color and a larger mobile size', () => {
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(BRAND_WORDMARK_COLOR).toBe('var(--foreground)');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain('font-size: clamp(3.5rem, 17vw, 8rem)');
  });

  it('renders the wordmark as a page title at the top of Daily', () => {
    const html = renderToStaticMarkup(createElement(BrandWordmark));
    expect(html).toContain('Management');
    expect(html).toContain('daily-brand-wordmark');
    expect(html).toMatch(/<h1\b/);
  });

  const fontPath = brandWordmarkFontPath();
  const hasFont = fs.existsSync(fontPath);
  it.skipIf(!hasFont)('ships Haglos-Regular.otf after npm run font:haglos', () => {
    expect(fs.statSync(fontPath).size).toBeGreaterThan(10_000);
  });
});
