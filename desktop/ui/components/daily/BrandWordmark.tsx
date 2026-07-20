import '@fontsource/archivo-black';
import { BRAND_ICON_COLOR } from '@/lib/brandIcon';
import { BRAND_WORDMARK_FONT, BRAND_WORDMARK_TEXT } from '@/lib/brandWordmark';
import './brandWordmark.css';

/** Big block-letter brand title for the Daily tab. */
export default function BrandWordmark() {
  return (
    <header className="daily-brand-wordmark" aria-label="Management">
      <h1
        className="daily-brand-wordmark__text"
        style={{ fontFamily: BRAND_WORDMARK_FONT, color: BRAND_ICON_COLOR }}
      >
        {BRAND_WORDMARK_TEXT}
      </h1>
    </header>
  );
}
