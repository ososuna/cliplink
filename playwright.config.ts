import { defineConfig, devices } from '@playwright/test';
import { e2eEnv } from './e2e/support/env';

const port = 4321;
const baseURL = e2eEnv.BETTER_AUTH_URL;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm build:e2e && pnpm start:e2e',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { ...e2eEnv, HOST: '127.0.0.1', PORT: String(port) },
  },
});
