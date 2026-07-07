import path from "path"
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

const host = process.env.TAURI_DEV_HOST;
const uiRoot = path.resolve(__dirname, "./desktop/ui");

// https://vite.dev/config/
export default defineConfig(async () => ({
  root: uiRoot,
  publicDir: path.resolve(__dirname, "./public"),
  envDir: path.resolve(__dirname, "."),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": uiRoot,
      "@mgmt/core": path.resolve(__dirname, "./shared/core/src/index.ts"),
      "@mgmt/sync": path.resolve(__dirname, "./shared/sync/src/index.ts"),
      "@mgmt/storage": path.resolve(__dirname, "./shared/storage/src/types.ts"),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `desktop/src-tauri`
      ignored: ["**/desktop/src-tauri/**"],
    },
  },
}));
