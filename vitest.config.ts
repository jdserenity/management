import { readFileSync } from 'node:fs';
import path from 'path';
import { defineConfig } from 'vitest/config';

const uiRoot = path.resolve(__dirname, './desktop/ui');
const appVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version as string;

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion) },
  test: {
    include: [
      'desktop/ui/**/*.test.ts',
      'scripts/**/*.test.ts',
      'shared/**/*.test.ts',
      'backend/**/*.test.ts',
      'mobile/**/*.test.ts'
    ]
  },
  resolve: {
    alias: {
      '@': uiRoot,
      '@mgmt/core': path.resolve(__dirname, './shared/core/src/index.ts'),
      '@mgmt/sync': path.resolve(__dirname, './shared/sync/src/index.ts'),
      '@mgmt/storage': path.resolve(__dirname, './shared/storage/src/index.ts')
    }
  }
});
