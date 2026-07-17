import { test, expect } from '@playwright/test';

test.describe('Auth — reset password', () => {
  test('invalid token shows error state', async ({ page }) => {
    await page.goto('/auth/reset-password?token=invalid-token-value');
    await expect(page).toHaveTitle(/EduShift/i);
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });
  });

  test('missing token shows error state', async ({ page }) => {
    await page.goto('/auth/reset-password');
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });
  });

  test('error state has link to request a new link', async ({ page }) => {
    await page.goto('/auth/reset-password?token=bad');
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('a[href*="/auth/forgot-password"]')).toBeVisible();
  });

  test('form validates password mismatch', async ({ page, baseURL }) => {
    // Intercept the validate endpoint to simulate a valid token.
    await page.route('**/v1/auth/reset-password/validate**', async (route) => {
      await route.fulfill({ status: 200, body: '{"success":true,"data":{"valid":true}}' });
    });
    await page.goto('/auth/reset-password?token=valid-mock-token');
    await expect(page.locator('#password')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#passwordConfirmation')).toBeVisible();
    // Submit with mismatched passwords.
    await page.locator('#password').fill('NewPass123!');
    await page.locator('#passwordConfirmation').fill('DifferentPass123!');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#passwordConfirmation-error')).toBeVisible();
  });
});
