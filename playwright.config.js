import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || 5173;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/*.spec.js'],
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-html', open: 'never' }],
    ['json', { outputFile: 'reports/playwright-results.json' }]
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.SKIP_SERVER ? undefined : {
    command: 'npm run dev:all',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
