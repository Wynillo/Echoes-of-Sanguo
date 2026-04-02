import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60_000,
  retries: isCI ? 1 : 0,
  reporter: 'list',

  expect: {
    timeout: 30_000,
  },

  use: {
    baseURL: isCI ? 'http://localhost:4173' : 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: isCI ? 'npx vite preview --port 4173' : 'npm run dev',
    url: isCI ? 'http://localhost:4173' : 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: isCI ? 60_000 : 30_000,
  },
});
