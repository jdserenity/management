import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'scripts/**/*.test.ts',
      'packages/**/*.test.ts',
      'apps/**/*.test.ts'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mgmt/core': path.resolve(__dirname, './packages/core/src/index.ts'),
      '@mgmt/sync': path.resolve(__dirname, './packages/sync/src/index.ts')
    }
  }
});
