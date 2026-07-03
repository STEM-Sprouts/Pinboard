import { defineConfig } from 'vitest/config';

// Runtime tests are headless by design (implemenation_plam/testing.md §2):
// Node environment, no DOM, no requestAnimationFrame, no wall clock.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
