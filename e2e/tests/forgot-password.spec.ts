import { test, expect } from '@playwright/test';
import { TENANT_ADMIN } from '../fixtures/test-users';

test.describe('Auth — forgot password', () => {
  test('page is reachable and shows the form', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page).toHaveTitle(/EduShift/i);
    await expect(page.locator('#tenantSlug')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('empty submit shows validation error', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#tenantSlug-error')).toBeVisible();
  });

  test('valid email shows success state', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.locator('#tenantSlug').fill(TENANT_ADMIN.tenantSlug);
    await page.locator('#email').fill(TENANT_ADMIN.email);
    await page.locator('button[type="submit"]').click();
    // The backend always returns 200 (prevent enumeration), so the
    // FE shows the success state regardless of whether the email exists.
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 10_000 });
  });

  test('back-to-login link navigates to /auth/login', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.locator('a[href*="/auth/login"]').first().click();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});
