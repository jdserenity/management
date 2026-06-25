import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  envDir: path.resolve(__dirname, '../..'),
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Management Companion',
        short_name: 'Mgmt',
        description: 'Mobile companion for focus sessions and exercise breaks',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      }
    })
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, '../../src') },
      { find: '@mgmt/core', replacement: path.resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: '@mgmt/sync', replacement: path.resolve(__dirname, '../../packages/sync/src/index.ts') },
      { find: '@mgmt/storage', replacement: path.resolve(__dirname, '../../packages/storage/src/index.ts') }
    ]
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
