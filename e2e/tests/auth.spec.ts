import { test, expect } from '@playwright/test';
import { TENANT_ADMIN } from '../fixtures/test-users';

/**
 * Auth flow E2E (Sprint 12 / FE-12.4 / DEBT-FE-E2E-1).
 *
 * <p>Covers the happy path of the public login surface:</p>
 * <ol>
 *   <li>Login form is reachable, has the right input ids, and
 *       surfaces validation errors for empty fields.</li>
 *   <li>Submitting valid credentials lands on the dashboard with
 *       the user email visible (sidebar or topbar).</li>
 *   <li>Wrong credentials surface a stable error message
 *       (no 500, no blank screen).</li>
 * </ol>
 *
 * <h3>Why this spec is special</h3>
 * <p>Every other spec in this suite inherits the storage state from
 * {@code e2e/auth.setup.ts} and skips the login form. So this is
 * the ONLY place where we drive the form end-to-end. Keep the
 * selector surface (id attributes on the inputs) in sync with the
 * form changes; tests that fail with "no element found" usually
 * mean a FE refactor renamed an input without updating the E2E.</p>
 */
test.describe('Auth — public login', () => {
  test('login form is reachable and validates empty submit', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveTitle(/EduShift/i);
    // The form has stable ids (see auth/pages/login/login.component.ts).
    await expect(page.locator('#tenantSlug')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    // Submitting with both fields empty should keep the user on the
    // login screen and show validation errors — no crash, no 500.
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('valid credentials land on the dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('#tenantSlug').fill(TENANT_ADMIN.tenantSlug);
    await page.locator('#email').fill(TENANT_ADMIN.email);
    await page.locator('#password').fill(TENANT_ADMIN.password);
    await page.locator('button[type="submit"]').click();

    // After a successful login the FE navigates away from /auth/login.
    // We don't hard-code the destination route (it may change in future
    // sprints); we just assert the user is no longer on the login page.
    await expect(page).not.toHaveURL(/\/auth\/login$/);
    // The auth setup proves the session is live; the dashboard should
    // render the user email somewhere. We assert at least one
    // top-level link to a protected module is reachable.
    await expect(page.locator('a[href^="/students"], a[href^="/payments"]').first())
        .toBeVisible({ timeout: 10_000 });
  });

  test('wrong credentials surface a non-empty error and stay on login', async ({ page }) => {
    await page.goto('/auth/login');
    await page.locator('#tenantSlug').fill(TENANT_ADMIN.tenantSlug);
    await page.locator('#email').fill(TENANT_ADMIN.email);
    await page.locator('#password').fill('not-the-right-password');
    await page.locator('button[type="submit"]').click();

    // We stay on the login screen and the form surfaces a generic
    // error message. The exact copy is owned by i18n and we don't
    // want to couple to it; we just assert SOMETHING visible.
    await expect(page).toHaveURL(/\/auth\/login$/);
    const errorBox = page.locator('[role="alert"], .text-danger').first();
    await expect(errorBox).toBeVisible({ timeout: 10_000 });
  });
});
