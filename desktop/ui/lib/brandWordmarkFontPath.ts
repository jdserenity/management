import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Bundled Haglos OTF (install via `npm run font:haglos` or manual drop from 1001fonts). */
export const BRAND_WORDMARK_FONT_FILE = 'Haglos-Regular.otf';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function brandWordmarkFontPath(): string {
  return path.join(uiRoot, 'assets', 'fonts', BRAND_WORDMARK_FONT_FILE);
}
