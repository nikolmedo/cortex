import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Explicit include: build outputs (dist/, server/dist/) must never be collected.
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
