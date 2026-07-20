import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BrandWordmark from '@/components/daily/BrandWordmark';
import { BRAND_WORDMARK_COLOR, BRAND_WORDMARK_FONT, BRAND_WORDMARK_TEXT } from './brandWordmark';

describe('brandWordmark', () => {
  it('uses Management in a rugged outdoor slab font', () => {
    expect(BRAND_WORDMARK_TEXT).toBe('Management');
    expect(BRAND_WORDMARK_FONT).toBe('"Alfa Slab One", serif');
    expect(BRAND_WORDMARK_COLOR).toBe('#ffffff');
  });

  it('renders the wordmark as a page title at the top of Daily', () => {
    const html = renderToStaticMarkup(createElement(BrandWordmark));
    expect(html).toContain('Management');
    expect(html).toContain('daily-brand-wordmark');
    expect(html).toMatch(/<h1\b/);
  });
});
