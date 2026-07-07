/** True when the webview is running inside Tauri (not plain `npm run dev` in a browser). */
export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
