import { defineConfig, devices } from '@playwright/test';

const isCi = Boolean(process.env.CI);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? (isCi ? 'http://127.0.0.1:4173' : 'http://localhost:5173');

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: isCi ? 1 : undefined,
  reporter: isCi ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: isCi
    ? {
        command: 'npm run preview --prefix frontend -- --host 127.0.0.1 --port 4173',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        command: 'npm run dev --prefix frontend',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
