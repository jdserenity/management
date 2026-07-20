# Project knowledge

## Haglos Daily wordmark font

- Haglos is **not** on npm and **must not** be committed (personal-use / no-redistribute demo). Install with `npm run font:haglos` (dafont zip is the reliable source; 1001fonts often fails automated fetch).
- `npm run build:companion` runs `font:haglos` first so the PWA has a bundled fallback. `@font-face` lists `local('Haglos')` **before** the OTF URL so desktop keeps using a system-installed Haglos when present — the auto-downloaded dafont file is a demo cut and must not override the Mac install.
- Without any Haglos (no system font, no OTF at build time), the wordmark falls back to generic cursive on companion.

## Customize habit reorder (drag)

- The first Customize habit reorder used HTML5 `draggable` on the whole row **without** `dataTransfer.setData` on dragstart. In Chromium / WKWebView that often lets you “pick up” a row while **drop never commits**, so reorder looked broken on desktop and companion alike — not a mobile-only issue.
- Fix: pointer capture on the grip (`pointerdown` / `move` / `up`), hit-test rows by Y via `findDropTargetId`, then `reorderStreakActivities`. No HTML5 DnD, no arrow buttons.
