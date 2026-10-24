import { BRAND_WORDMARK_COLOR, BRAND_WORDMARK_FONT, BRAND_WORDMARK_TEXT } from '@/lib/brandWordmark';
import './brandWordmark.css';

type Props = {
  /** Thick red border when the unbroken-chain calendar has 2+ consecutive X's. */
  unbrokenChain?: boolean;
};

/** Big block-letter brand title for the Daily tab. */
export default function BrandWordmark({ unbrokenChain = false }: Props) {
  return (
    <header
      className={`daily-brand-wordmark${unbrokenChain ? ' daily-brand-wordmark--unbroken-chain' : ''}`}
      aria-label="Management"
    >
      <h1
        className="daily-brand-wordmark__text"
        style={{ fontFamily: BRAND_WORDMARK_FONT, color: BRAND_WORDMARK_COLOR }}
      >
        {BRAND_WORDMARK_TEXT}
      </h1>
    </header>
  );
}
