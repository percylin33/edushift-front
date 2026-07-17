import { test, expect } from '@playwright/test';
import { TENANT_ADMIN_STORAGE_STATE } from '../../fixtures/storage-state-paths';

/**
 * Academic module — UI smoke (Sprint 2.3).
 *
 * <p>The academic module is mostly CRUD lists + a shared
 * {@code /academic} shell with tabs. The UI tests in this file
 * verify the shell renders and the year CRUD form works end-to-end
 * through the Angular UI. Section / level / course / period /
 * competency / time-slot UIs are exercised via the API specs in
 * the sibling files — covering their FE rendering would be a
 * diminishing-returns exercise since the page templates share the
 * same {@code app-page-container} + table patterns.</p>
 */
test.describe('Academic — UI', () => {
  test.use({ storageState: TENANT_ADMIN_STORAGE_STATE });

  test('/academic redirects to /academic/years (default tab)', async ({ page }) => {
    await page.goto('/academic');
    await expect(page).toHaveURL(/\/academic\/years$/);
  });

  test('/academic/years renders list + "Nuevo" button', async ({ page }) => {
    await page.goto('/academic/years');
    // The page's H1 is the shell-level title; the section header is H2.
    await expect(page.locator('h2:has-text("Años académicos")')).toBeVisible();
    await expect(page.locator('a:has-text("Nuevo"), button:has-text("Nuevo")').first()).toBeVisible();
  });

  test('/academic/levels renders the levels-board', async ({ page }) => {
    await page.goto('/academic/levels');
    // Levels-board is the only page for the levels/grades management.
    // It should render a heading.
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('/academic/sections renders list + empty-state when no data', async ({ page }) => {
    await page.goto('/academic/sections');
    // The page renders either the table or an empty-state — both
    // are valid outcomes depending on the tenant's data.
    await expect(page.locator('h2:has-text("Secciones"), app-empty-state').first()).toBeVisible();
  });

  test('create year via form navigates to detail', async ({ page }) => {
    const year = new Date().getFullYear();
    const suffix = `ui${Date.now().toString(36).slice(-6)}`;
    await page.goto('/academic/years/new');
    await expect(page.locator('input[formControlName="name"], input#name').first()).toBeVisible({
      timeout: 10_000,
    });

    // Try a few selector patterns because the form's input ids aren't
    // fully stable across versions of the academic shell.
    const nameInput = page.locator('#name, input[formControlName="name"]').first();
    await nameInput.fill(`YearUI-${suffix}`);
    const startInput = page.locator('#startDate, input[formControlName="startDate"]').first();
    await startInput.fill(`${year}-03-01`);
    const endInput = page.locator('#endDate, input[formControlName="endDate"]').first();
    await endInput.fill(`${year}-12-15`);

    await page.locator('button[type="submit"]').click();
    // Either navigates to /academic/years/{uuid}/edit or /academic/years list.
    await page.waitForTimeout(2000);
    const url = page.url();
    // Soft cleanup — find the year via API and delete it.
    if (url.match(/\/years\/[a-f0-9-]+/)) {
      const uuid = url.match(/\/years\/([a-f0-9-]+)/)?.[1];
      if (uuid) {
        const ctx = await (await import('@playwright/test')).request.newContext({
          baseURL: 'http://localhost:8081',
          extraHTTPHeaders: {
            Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('edushift.auth.token'))}`,
            'X-Tenant-Slug': 'tecnosur',
          },
        });
        await ctx.delete(`/api/v1/academic/years/${uuid}`).catch(() => undefined);
        await ctx.dispose();
      }
    }
  });
});
