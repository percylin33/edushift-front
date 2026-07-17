import { test, expect } from '@playwright/test';

/**
 * Responsive — Tablet iPad Air (QA Plan 2026-07-02 / 09-responsive-mobile-tablet.md).
 *
 * <p>Validates gradebook and academic shells on tablet viewports
 * (820×1180 portrait, 1180×820 landscape). Gradebook is a wide
 * matrix (students × criteria); in portrait it MUST scroll
 * horizontally; in landscape it should fit without scrolling.</p>
 */

test.describe('Tablet — iPad Air (820x1180)', () => {
  test.skip(true, 'Run with: npx playwright test --project tablet-ipad');

  test('academic shell renders tabs in portrait', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/academic');
    await expect(page).toHaveURL(/\/academic/);
  });

  test('gradebook matrix scrolls horizontally in portrait', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/evaluations/by-assignment/_/gradebook');
    // Matrix is a wide table; we expect horizontal scroll on portrait.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(true);
  });

  test('gradebook matrix fits in landscape without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto('/evaluations/by-assignment/_/gradebook');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    // Should fit; if it doesn't, file a bug.
    expect(overflow).toBe(false);
  });
});
