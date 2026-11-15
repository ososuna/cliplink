import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { e2eEnv, e2eServer } from './e2e/support/env';

const { port, baseURL } = e2eServer;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm db:migrate && pnpm build:e2e && pnpm start:e2e',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { ...e2eEnv, HOST: '127.0.0.1', PORT: String(port) },
  },
});
