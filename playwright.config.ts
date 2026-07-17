import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for EduShift front-end (Sprint 12 / FE-12.1+ /
 * DEBT-FE-E2E-1).
 *
 * <h3>Layout</h3>
 * - Tests live in {@code e2e/tests/} (not the default {@code tests/} to
 *   avoid the Angular CLI schematic claiming the folder).
 * - Auth setup lives in {@code e2e/auth.setup.ts} and stores a
 *   {@code storageState} per role in {@code e2e/.auth/}. Re-using the
 *   storage state across tests cuts login time by ~95%.
 * - {@code api-helpers.ts} does the login via the backend's
 *   {@code POST /api/v1/auth/login} (no UI dependency, no flake from
 *   the login form).
 *
 * <h3>Servers</h3>
 * - The backend is expected at {@code http://localhost:8080} (default
 *   dev). On CI we set {@code BASE_URL} to the staging host and skip
 *   the {@code webServer} block.
 * - The Angular dev server is started by Playwright's {@code webServer}
 *   so a fresh checkout can run {@code npm run e2e} without manual
 *   setup. Production builds use {@code http-server} (see
 *   {@code npm run e2e:ci}).
 *
 * <h3>Browser matrix</h3>
 * - {@code chromium-desktop} (1280x800) — primary dev loop.
 * - {@code mobile-pixel-7} — sanity check on mobile widths we ship
 *   for (the admin payments page already has a mobile layout from
 *   FE-11.4).
 *
 * <h3>Traces</h3>
 * - {@code trace: 'on-first-retry'} keeps the repo lean; CI captures
 *   full traces via {@code --trace on} when the test reporter says
 *   so. Failed-test screenshots go to
 *   {@code test-results/{test-title}/}.
 */
export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // Local default dropped from `undefined` (which lets Playwright use all
  // cores) to a fixed 2 workers. With 4+ workers the dev BE hits
  // connection-pool contention and the suite turns flaky. Override with
  // PWTEST_WORKERS env var when you need a clean parallel run.
  workers: process.env['CI'] ? 2 : (process.env['PWTEST_WORKERS'] ? Number(process.env['PWTEST_WORKERS']) : 2),
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',

  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { maxDiffPixels: 50 },
  },

  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The FE expects the tenant slug via the X-Tenant-Slug header; the
    // dev environment defaults to "demo" (see environment.development.ts).
    // We forward it explicitly in api-helpers.ts; nothing to do here.
  },

  // Auth state files are produced by e2e/auth.setup.ts (tenant admin,
  // teacher, staff, parent, student) and e2e/auth.admin.setup.ts (super
  // admin). Playwright re-uses them across the suite to skip the login
  // form. STUDENT was added in Phase 0 / V74.

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'admin-setup',
      testMatch: /.*\.admin\.setup\.ts/,
    },
    {
      name: 'chromium-desktop',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /admin-smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Re-use the storageState produced by auth.setup.ts so the
        // login form is exercised only by auth.spec.ts.
        storageState: 'e2e/.auth/tenant-admin.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-admin',
      testMatch: /admin-smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: 'e2e/.auth/super-admin.json',
      },
      dependencies: ['admin-setup'],
    },
    {
      name: 'mobile-pixel-7',
      testMatch: /.*\.spec\.ts/,
      testIgnore: /admin-smoke\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        storageState: 'e2e/.auth/tenant-admin.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: process.env['CI']
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://localhost:4200',
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
        env: {
          // Make sure the FE points at the local backend even if
          // the dev has a stale shell variable.
          API_URL: process.env['API_URL'] ?? 'http://localhost:8080/api',
        },
      },
});
