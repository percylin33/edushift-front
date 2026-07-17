import { test, expect } from '@playwright/test';
import { TENANT_ADMIN_STORAGE_STATE } from '../../fixtures/storage-state-paths';

/**
 * Visual regression — mobile dashboard (Sprint 2.15 / Track A).
 *
 * <p>Desktop and mobile share the same spec file via the Playwright
 * project split. The mobile-pixel-7 project uses the Pixel 7 viewport
 * (412x915) which exercises the responsive sidebar collapse +
 * hamburger menu. This file pins the dashboard under that viewport
 * so a regression that breaks mobile layout (e.g. a fixed-width
 * container that overflows) gets caught here rather than only on the
 * weekly mobile matrix lane (which only re-runs the existing specs,
 * not the dashboard).</p>
 *
 * <p><b>Mask policy:</b> same as {@code dashboard.spec.ts} —
 * KPI values, user pill, and date-relative labels.</p>
 */
const BASE = process.env['BASE_URL'] ?? 'http://localhost:4201';

test.describe('Visual regression — /dashboard (mobile)', () => {
  test.use({
    storageState: TENANT_ADMIN_STORAGE_STATE,
    viewport: { width: 412, height: 915 },
  });

  test('dashboard home layout under Pixel 7', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('app-stat-card').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await expect(page).toHaveScreenshot('dashboard-home-mobile.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.02,
      mask: [
        page.locator('app-stat-card .text-2xl'),
        page.locator('.user-pill'),
        page.locator('[data-testid="recent-closed"]'),
      ],
    });
  });
});