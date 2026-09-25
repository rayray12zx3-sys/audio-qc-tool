import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:8123', headless: true },
  webServer: { command: 'python -m http.server 8123 --bind 127.0.0.1', url: 'http://127.0.0.1:8123', reuseExistingServer: true },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*app\.spec\.mjs$/,
    },
    {
      name: 'firefox-smoke',
      use: { ...devices['Desktop Firefox'] },
      testMatch: /.*desktop-smoke\.spec\.mjs$/,
    },
    {
      name: 'webkit-smoke',
      use: { ...devices['Desktop Safari'] },
      testMatch: /.*desktop-smoke\.spec\.mjs$/,
    },
  ],
});
