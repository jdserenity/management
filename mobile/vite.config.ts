import { readFileSync } from 'node:fs';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const appVersion = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).version as string;

export default defineConfig({
  envDir: path.resolve(__dirname, '..'),
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      workbox: {
        // Keep default precache (reliable loads). Allow sql-wasm (~660KB) in the precache manifest.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      manifest: {
        name: 'Management Companion',
        short_name: 'Mgmt',
        description: 'Mobile companion for focus sessions and exercise breaks',
        theme_color: '#0437F2',
        background_color: '#0437F2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' }
        ]
      }
    })
  ],
  resolve: {
    alias: [
      { find: '@/lib/navConfig', replacement: path.resolve(__dirname, 'src/companionNavConfig.ts') },
      { find: '@', replacement: path.resolve(__dirname, '../desktop/ui') },
      { find: '@mgmt/core', replacement: path.resolve(__dirname, '../shared/core/src/index.ts') },
      { find: '@mgmt/sync', replacement: path.resolve(__dirname, '../shared/sync/src/index.ts') },
      { find: '@mgmt/storage', replacement: path.resolve(__dirname, '../shared/storage/src/index.ts') }
    ]
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
