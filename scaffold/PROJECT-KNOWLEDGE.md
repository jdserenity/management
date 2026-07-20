# Project knowledge

## Haglos Daily wordmark font

- Haglos is **not** on npm and **must not** be committed (personal-use / no-redistribute demo). Install with `npm run font:haglos` (dafont zip is the reliable source; 1001fonts often fails automated fetch).
- `npm run build` and `npm run build:companion` run `font:haglos` first. Without the OTF at build time, `@font-face` keeps a broken relative URL and the phone companion falls back to a generic cursive face — desktop can look “fine” if the Mac already has Haglos, which hides the bug.
- Companion Cloudflare deploy uses `build:companion`, so production builds download the font in CI.

## Customize habit reorder on phone

- HTML5 `draggable` can show a “picked up” ghost on mobile Safari but drop targets often never fire. Customize → Streaks uses **up/down arrow buttons** (same idea as the morning stretch editor) so reorder works on companion; drag remains as a desktop extra.
