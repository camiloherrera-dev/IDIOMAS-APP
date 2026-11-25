import { defineConfig, devices } from '@playwright/test';

/** cuentas y sincronización contra el servidor local completo (scripts/dev-server.ts con PGlite) */
export default defineConfig({
  testDir: './tests/e2e-cuentas',
  timeout: 240_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4175', trace: 'retain-on-failure', locale: 'es-CO' },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run serve:full',
    env: { PORT: '4175' },
    url: 'http://localhost:4175/api/config',
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
