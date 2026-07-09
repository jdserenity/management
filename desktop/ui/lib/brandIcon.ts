/** Royal blue app icon fill — shared by desktop bundle, PWA, and favicon assets. */
export const BRAND_ICON_COLOR = '#0437F2';

/** macOS-style corner radius as a fraction of the square edge length. */
export const BRAND_ICON_CORNER_RATIO = 0.2237;

export function brandAppIconSvg(size = 1024): string {
  const r = Math.round(size * BRAND_ICON_CORNER_RATIO);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Management"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BRAND_ICON_COLOR}"/></svg>`;
}

/**
 * Solid black rounded square for the macOS menu bar tray (template icon).
 * Black + transparency is the standard template shape; the system tints it for light/dark menu bars
 * so it stays solid and readable — never a washed-out white.
 */
export function brandTrayIconSvg(size = 1024, fill = '#000000', insetRatio = 0.0625): string {
  const inset = Math.round(size * insetRatio);
  const edge = size - inset * 2;
  const r = Math.round(edge * BRAND_ICON_CORNER_RATIO);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect x="${inset}" y="${inset}" width="${edge}" height="${edge}" rx="${r}" ry="${r}" fill="${fill}"/></svg>`;
}

/**
 * Monitoring-off tray mark: full-opacity hollow rounded square (not a faded fill).
 * Still solid black for template rendering — visually distinct from the filled “on” icon.
 */
export function brandTrayMonitoringOffSvg(size = 1024, stroke = '#000000', insetRatio = 0.0625, strokeRatio = 0.12): string {
  const inset = Math.round(size * insetRatio);
  const edge = size - inset * 2;
  const r = Math.round(edge * BRAND_ICON_CORNER_RATIO);
  const sw = Math.max(2, Math.round(size * strokeRatio));
  const half = sw / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect x="${inset + half}" y="${inset + half}" width="${edge - sw}" height="${edge - sw}" rx="${Math.max(0, r - half)}" ry="${Math.max(0, r - half)}" fill="none" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
}
