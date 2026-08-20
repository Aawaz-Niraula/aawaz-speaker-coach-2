import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Fast isolated tests only. Pure functions and server-rendered component
 * checks need no network, database, or browser, so this is safe on every change.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
