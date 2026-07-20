/** Daily-tab brand wordmark — Haglos display face (outdoor / adventure feel). */
export const BRAND_WORDMARK_TEXT = 'Management';
export const BRAND_WORDMARK_FONT = '"Haglos", cursive';
export const BRAND_WORDMARK_COLOR = '#ffffff';

export type BrandWordmarkInlineStyle = { fontFamily: string; color: string };

export function buildBrandWordmarkInlineStyle(): BrandWordmarkInlineStyle {
  return { fontFamily: BRAND_WORDMARK_FONT, color: BRAND_WORDMARK_COLOR };
}

let inlineStyleBuilder = buildBrandWordmarkInlineStyle;

/** Test hook — pass a stub instead of the real builder. */
export function mockBrandWordmarkInlineStyleBuilder(stub: () => BrandWordmarkInlineStyle) {
  inlineStyleBuilder = stub;
}

export function resetBrandWordmarkInlineStyleBuilder() {
  inlineStyleBuilder = buildBrandWordmarkInlineStyle;
}

export function brandWordmarkInlineStyle(): BrandWordmarkInlineStyle {
  return inlineStyleBuilder();
}
