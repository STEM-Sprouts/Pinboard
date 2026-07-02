import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite (implemenation_plam/testing.md §4 rules: assert on observable
 * state, seed known state, no arbitrary sleeps). Runs against the dev server;
 * Chromium only — Pinboard targets Chrome/Edge (WebSerial).
 */
export default defineConfig({
  testDir: './e2e',
  // One dev server + a CPU-heavy AVR emulator: serial execution keeps
  // timing observations stable.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
