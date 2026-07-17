import { defineConfig, devices } from '@playwright/test';

/**
 * Extended Playwright config for QA Plan 2026-07-02 / 09-responsive-mobile-tablet.md.
 *
 * <p>This file is meant to <b>extend</b> the existing
 * {@code playwright.config.ts} (the one Playwright actually
 * loads). Local dev: launch with {@code npx playwright test --config
 * playwright.qa.config.ts}.</p>
 *
 * <p>Adds projects for iPhone 14, iPad Air, and Galaxy S22 in
 * addition to the existing setup/admin/chromium-desktop/mobile-pixel-7
 * projects. Keep this file in sync with playwright.config.ts when
 * the primary config evolves.</p>
 */
const baseConfig = require('./playwright.config');

export default defineConfig({
  ...baseConfig,
  projects: [
    ...(baseConfig.projects ?? []),
    {
      name: 'mobile-iphone',
      testMatch: /.*\.(mobile|tablet)\.spec\.ts$/,
      use: {
        ...devices['iPhone 14'],
      },
      dependencies: ['setup'],
    },
    {
      name: 'tablet-ipad',
      testMatch: /.*\.(mobile|tablet)\.spec\.ts$/,
      use: {
        ...devices['iPad (gen 7)'],
      },
      dependencies: ['setup'],
    },
  ],
});
