import path from 'path';
import { defineConfig } from 'vitest/config';

const uiRoot = path.resolve(__dirname, './desktop/ui');

export default defineConfig({
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
      '@mgmt/sync': path.resolve(__dirname, './shared/sync-client/src/index.ts'),
      '@mgmt/storage': path.resolve(__dirname, './shared/storage/src/index.ts')
    }
  }
});
