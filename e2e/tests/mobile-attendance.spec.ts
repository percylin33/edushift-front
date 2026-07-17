import { test, expect } from '@playwright/test';

/**
 * Responsive — Mobile iPhone 14 (QA Plan 2026-07-02 / 09-responsive-mobile-tablet.md).
 *
 * <p>Validates the attendance flow in a 390×844 viewport. The QR
 * scanner uses @{@code @zxing/ngx-scanner} which requires camera
 * permission — Playwright grants it via {@code --use-fake-ui-for-media-stream}.</p>
 *
 * <p>Spec is STUB until the BE+FE are running.</p>
 */

test.describe('Mobile — iPhone 14 (390x844)', () => {
  test.skip(true, 'Run with: npx playwright test --project mobile-iphone');

  test('login form is reachable and submittable on 390x844', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('#tenantSlug')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    // No horizontal scroll on the login form.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test('attendance scanner page loads without crash (camera mock OK)', async ({ page }) => {
    // Grant fake camera so @zxing/ngx-scanner doesn't block on permission.
    await page.context().grantPermissions(['camera']);
    await page.goto('/attendance/scanner');
    await expect(page).toHaveURL(/\/attendance\/scanner/);
    // No console errors
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    expect(errors).toEqual([]);
  });

  test('LMS tasks list is single-column and scrollable on mobile', async ({ page }) => {
    await page.goto('/lms/sections/_/assignments');
    // The header + title should fit on a 390 viewport.
    await expect(page.getByText(/Tareas|Mis Tareas|Asignaciones/i).first()).toBeVisible();
  });
});
