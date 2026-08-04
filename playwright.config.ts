import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the demo app's hidden `/e2e` harness, which embeds the library
 * from source via the workspace path mapping — so these tests exercise the real
 * editor, real Fabric and a real canvas. Pixel-level export assertions (crop
 * resolution, sharpness) can only be made here; the unit suite is DOM-free.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:4317',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npx ng serve demo --port 4317',
    url: 'http://localhost:4317',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
