import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:8123', browserName: 'chromium', headless: true },
  webServer: { command: 'python -m http.server 8123 --bind 127.0.0.1', url: 'http://127.0.0.1:8123', reuseExistingServer: true }
});
