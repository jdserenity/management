# Project knowledge

## Haglos Daily wordmark font

- Haglos is **not** on npm and **must not** be committed (personal-use / no-redistribute demo). Install with `npm run font:haglos` (dafont zip is the reliable source; 1001fonts often fails automated fetch).
- `npm run build:companion` runs `font:haglos` first so the PWA has a bundled fallback. `@font-face` lists `local('Haglos')` **before** the OTF URL so desktop keeps using a system-installed Haglos when present — the auto-downloaded dafont file is a demo cut and must not override the Mac install.
- Without any Haglos (no system font, no OTF at build time), the wordmark falls back to generic cursive on companion.
