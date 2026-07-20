import { BRAND_WORDMARK_COLOR, BRAND_WORDMARK_FONT, BRAND_WORDMARK_TEXT } from '@/lib/brandWordmark';
import './brandWordmark.css';

/** Big block-letter brand title for the Daily tab. */
export default function BrandWordmark() {
  return (
    <header aria-label="Management">
      <h1
        className="daily-brand-wordmark__text"
        style={{ fontFamily: BRAND_WORDMARK_FONT, color: BRAND_WORDMARK_COLOR }}
      >
        {BRAND_WORDMARK_TEXT}
      </h1>
    </header>
  );
}
