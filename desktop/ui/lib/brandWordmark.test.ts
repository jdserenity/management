import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BrandWordmark from '@/components/daily/BrandWordmark';
import { BRAND_ICON_COLOR } from './brandIcon';
import { BRAND_WORDMARK_FONT, BRAND_WORDMARK_TEXT } from './brandWordmark';

describe('brandWordmark', () => {
  it('uses lowercase management in a block display font colored with brand blue', () => {
    expect(BRAND_WORDMARK_TEXT).toBe('management');
    expect(BRAND_WORDMARK_FONT).toBe('"Archivo Black", sans-serif');
    expect(BRAND_ICON_COLOR).toBe('#0437F2');
  });

  it('renders the wordmark as a page title at the top of Daily', () => {
    const html = renderToStaticMarkup(createElement(BrandWordmark));
    expect(html).toContain('management');
    expect(html).toContain('daily-brand-wordmark');
    expect(html).toMatch(/<h1\b/);
  });
});
