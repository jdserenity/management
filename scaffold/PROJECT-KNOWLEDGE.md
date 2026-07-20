# Project knowledge

## Haglos Daily wordmark font

- Haglos is **not** on npm and **must not** be committed (personal-use / no-redistribute demo). Install with `npm run font:haglos` (dafont zip is the reliable source; 1001fonts often fails automated fetch).
- `npm run build` and `npm run build:companion` run `font:haglos` first. Without the OTF at build time, `@font-face` keeps a broken relative URL and the phone companion falls back to a generic cursive face — desktop can look “fine” if the Mac already has Haglos, which hides the bug.
- Companion Cloudflare deploy uses `build:companion`, so production builds download the font in CI.

## Customize habit reorder (drag)

- The first Customize habit reorder used HTML5 `draggable` on the whole row **without** `dataTransfer.setData` on dragstart. In Chromium / WKWebView that often lets you “pick up” a row while **drop never commits**, so reorder looked broken on desktop and companion alike — not a mobile-only issue.
- Fix: pointer capture on the grip (`pointerdown` / `move` / `up`), hit-test rows by Y via `findDropTargetId`, then `reorderStreakActivities`. No HTML5 DnD, no arrow buttons.
