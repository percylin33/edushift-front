import { test, expect } from '@playwright/test';
import { TENANT_ADMIN_STORAGE_STATE } from '../../fixtures/storage-state-paths';

/**
 * Visual regression — login form (Sprint 2.15 / Track A).
 *
 * <p>The public {@code /auth/login} form is the most stable surface in
 * the SPA: no auth state, no async data, no per-tenant differences. It
 * is the canonical first baseline to commit when bootstrapping this
 * lane — it gives the team a known-good image to diff against on every
 * PR that touches the auth feature module.</p>
 *
 * <p><b>Mask policy:</b> none — the form has no dynamic content.</p>
 *
 * <p><b>Why an empty storageState:</b> the project-level config sets
 * the default to {@code TENANT_ADMIN_STORAGE_STATE}. For a public
 * route we must override it, otherwise the SPA boots into the
 * dashboard and we never reach the login form (see lesson 14 in
 * {@code docs/qa/e2e-phase2-lessons.md}).</p>
 *
 * <h3>Baseline generation</h3>
 * <p>The first run with no snapshot committed produces the baseline
 * automatically. For an explicit regeneration use
 * {@code npx playwright test --update-snapshots e2e/tests/visual}.
 * Snapshots are project-namespaced — this same spec produces two
 * files (one for {@code chromium-desktop}, one for
 * {@code mobile-pixel-7}).</p>
 */
const BASE = process.env['BASE_URL'] ?? 'http://localhost:4201';

test.describe('Visual regression — /auth/login', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login form layout', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`);

    // Wait for the form to be fully rendered before screenshotting.
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Disable CSS animations + transitions so the screenshot is
    // deterministic across machines. Animations that are mid-flight
    // at screenshot time produce flaky diffs.
    await expect(page).toHaveScreenshot('login-form.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});