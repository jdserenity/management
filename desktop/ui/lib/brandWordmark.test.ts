import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BrandWordmark from '@/components/daily/BrandWordmark';
import {
  BRAND_WORDMARK_COLOR,
  BRAND_WORDMARK_FONT,
  BRAND_WORDMARK_TEXT,
  brandWordmarkInlineStyle,
  buildBrandWordmarkInlineStyle,
  mockBrandWordmarkInlineStyleBuilder,
  resetBrandWordmarkInlineStyleBuilder
} from './brandWordmark';
import { brandWordmarkFontPath } from './brandWordmarkFontPath';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cssPath = path.join(root, 'desktop/ui/components/daily/brandWordmark.css');

describe('brandWordmark', () => {
  it('uses Management in Haglos', () => {
    expect(BRAND_WORDMARK_TEXT).toBe('Management');
    expect(BRAND_WORDMARK_FONT).toBe('"Haglos", cursive');
    expect(BRAND_WORDMARK_COLOR).toBe('#ffffff');
  });

  it('buildBrandWordmarkInlineStyle maps constants to inline style', () => {
    expect(buildBrandWordmarkInlineStyle()).toEqual({
      fontFamily: BRAND_WORDMARK_FONT,
      color: BRAND_WORDMARK_COLOR
    });
  });

  it('mockBrandWordmarkInlineStyleBuilder swaps the style source', () => {
    mockBrandWordmarkInlineStyleBuilder(() => ({ fontFamily: 'mock', color: '#000000' }));
    expect(brandWordmarkInlineStyle()).toEqual({ fontFamily: 'mock', color: '#000000' });
    resetBrandWordmarkInlineStyleBuilder();
    expect(brandWordmarkInlineStyle()).toEqual(buildBrandWordmarkInlineStyle());
  });

  it('declares Haglos @font-face pointing at the bundled OTF', () => {
    const css = fs.readFileSync(cssPath, 'utf8');
    expect(css).toContain("font-family: 'Haglos'");
    expect(css).toContain('Haglos-Regular.otf');
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
