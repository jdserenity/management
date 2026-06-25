/** Royal blue app icon fill — shared by desktop bundle, PWA, and favicon assets. */
export const BRAND_ICON_COLOR = '#1434A4';

/** macOS-style corner radius as a fraction of the square edge length. */
export const BRAND_ICON_CORNER_RATIO = 0.2237;

export function brandAppIconSvg(size = 1024): string {
  const r = Math.round(size * BRAND_ICON_CORNER_RATIO);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Management"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BRAND_ICON_COLOR}"/></svg>`;
}

/** White rounded square for macOS menu bar tray (transparent background). */
export function brandTrayIconSvg(size = 1024, fill = '#FFFFFF', insetRatio = 0.0625): string {
  const inset = Math.round(size * insetRatio);
  const edge = size - inset * 2;
  const r = Math.round(edge * BRAND_ICON_CORNER_RATIO);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect x="${inset}" y="${inset}" width="${edge}" height="${edge}" rx="${r}" ry="${r}" fill="${fill}"/></svg>`;
}
