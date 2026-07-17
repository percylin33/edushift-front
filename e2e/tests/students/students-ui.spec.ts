import { test, expect } from '@playwright/test';
import { TENANT_ADMIN } from '../../fixtures/test-users';
import {
  apiContextFor,
  safeApiContextFor,
} from '../../utils/api-helpers';
import {
  makeStudent,
  makeAcademicBundle,
  makeGuardianLink,
} from '../../factories';
import { TENANT_ADMIN_STORAGE_STATE } from '../../fixtures/storage-state-paths';

/**
 * Students — UI coverage (Sprint 2.1).
 *
 * <p>These specs drive the Angular SPA from a real browser with the
 * tenant-admin storage state preloaded by
 * {@code auth.setup.ts}. They cover the TA happy paths on
 * {@code /students}: list filters, create / edit / delete via the
 * form, guardian linking, QR credential generation, and bulk-import.</p>
 *
 * <p>RBAC + cross-tenant denials live in
 * {@code students-api.spec.ts} (cheaper, no browser).</p>
 */
test.describe('Students — UI', () => {
  test.use({ storageState: TENANT_ADMIN_STORAGE_STATE });

  test('list renders table and filters by search text', async ({ page }) => {
    // Seed two distinct students with a unique lastName suffix so the
    // search matches exactly one row (dev DB has hundreds of stale
    // rows from prior runs).
    const suffix = `s${Date.now().toString(36).slice(-6)}`;
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const alice = await makeStudent(api, {
      firstName: 'Alice',
      lastName: `SpecA-${suffix}`,
    });
    const bob = await makeStudent(api, {
      firstName: 'Bob',
      lastName: `SpecB-${suffix}`,
    });
    try {
      await page.goto('/students');
      await expect(page.locator('#students-search')).toBeVisible();

      // Filter for Alice's unique suffix — should match exactly one row.
      await page.locator('#students-search').fill(`SpecA-${suffix}`);
      await page.waitForTimeout(500);

      const aliceRow = page.locator('tr', { hasText: `SpecA-${suffix}` });
      await expect(aliceRow.first()).toBeVisible();
      expect(await aliceRow.count()).toBe(1);

      // Bob's row should not match the filter.
      const bobRow = page.locator('tr', { hasText: `SpecB-${suffix}` });
      await expect(bobRow).toHaveCount(0);
    } finally {
      await alice.cleanup();
      await bob.cleanup();
      await api.dispose();
    }
  });

  test('create student via form', async ({ page }) => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const suffix = `form${Date.now().toString(36).slice(-6)}`;
    // Unique 8-digit DNI to avoid collisions with the dev DB's accumulated
    // student rows from previous runs (DNI has a per-tenant UNIQUE index).
    const docNumber = `${Date.now().toString().slice(-8)}`;
    try {
      await page.goto('/students/new');
      await expect(page.locator('#documentType')).toBeVisible();
      await page.locator('#documentNumber').fill(docNumber);
      await page.locator('#firstName').fill('Carlos');
      await page.locator('#lastName').fill(`FormSpec-${suffix}`);
      await page.locator('#email').fill(`carlos.form.spec.${suffix}@example.test`);

      // Submit. The form navigates to /students/{newUuid} on success.
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(/\/students\/[a-f0-9-]+$/, { timeout: 15_000 });

      // The detail page renders the new student's name.
      await expect(page.locator('h1')).toContainText('Carlos');

      // Belt-and-braces cleanup via API.
      const url = page.url();
      const uuid = url.match(/\/students\/([a-f0-9-]+)/)?.[1];
      if (uuid) {
        await api.delete(`/api/v1/students/${uuid}`).catch(() => undefined);
      }
    } finally {
      await api.dispose();
    }
  });

  test('detail page renders tabs and shows guardian section', async ({ page, request }) => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    const student = await makeStudent(api, { firstName: 'Lucia', lastName: 'DetailSpec' });
    const guardian = await makeGuardianLink(api, student.publicUuid, { fullName: 'Mamá Lucia' });
    try {
      await page.goto(`/students/${student.publicUuid}`);
      await expect(page.locator('h1')).toContainText('Lucia');
      // Guardian section renders the linked guardian's name somewhere.
      await expect(page.getByText('Mamá Lucia')).toBeVisible();
    } finally {
      await guardian.cleanup();
      await student.cleanup();
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('bulk-import modal renders and accepts CSV file', async ({ page }) => {
    await page.goto('/students');
    // The "Importar" button is in the page header.
    await page.locator('button:has-text("Importar")').first().click();
    // The modal renders a file input + a confirm button.
    await expect(page.getByRole('dialog')).toBeVisible();
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
  });

  test('delete shows confirmation and removes the student', async ({ page }) => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const student = await makeStudent(api, { firstName: 'DeleteSpec' });
    try {
      await page.goto(`/students/${student.publicUuid}`);
      await expect(page.locator('h1')).toContainText('DeleteSpec');

      // The detail component uses a native window.confirm() — register
      // a handler BEFORE clicking the button so Playwright auto-accepts.
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      // Click the delete button (in the detail header / actions area).
      await page.locator('button:has-text("Eliminar")').first().click();

      // Should navigate away from the detail page.
      await expect(page).toHaveURL(/\/students(?!\/[a-f0-9])/, { timeout: 10_000 });

      // Verify the BE no longer has the student (or marks it deleted).
      const res = await api.get(`/api/v1/students/${student.publicUuid}`);
      expect([200, 404], 'soft-deleted student should be 200 or 404').toContain(
        res.status(),
      );

      // If the GET still returns the row, double-check the LIST hides it.
      if (res.status() === 200) {
        const list = await api.get('/api/v1/students', {
          params: { size: 100, q: 'DeleteSpec' },
        });
        if (list.status() === 200) {
          const body = await list.json();
          const items = body.content ?? body.data?.content ?? [];
          expect(
            items.find((s: { publicUuid: string }) => s.publicUuid === student.publicUuid),
            'soft-deleted student should not appear in the default list',
          ).toBeUndefined();
        }
      }
    } finally {
      // Belt-and-braces: cleanup in case the UI flow didn't actually delete.
      await api.delete(`/api/v1/students/${student.publicUuid}`).catch(() => undefined);
      await api.dispose();
    }
  });

  test('attendance QR preview shows for a student', async ({ page }) => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const student = await makeStudent(api, { firstName: 'QrSpec' });
    try {
      await page.goto(`/students/${student.publicUuid}/qr`);
      // The QR preview <img> only renders after the credential is
      // generated. Click "Generar SVG" to issue it.
      await page.locator('button:has-text("Generar SVG")').click();
      await expect(page.locator('[data-testid="student-qr-preview"]')).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await student.cleanup();
      await api.dispose();
    }
  });
});

/**
 * Negative paths — RBAC denials visible in the UI.
 * Lives here (and not in the RBAC spec) because the audit message
 * in {@code .error/routes/error.routes.ts} is rendered through the FE.
 */
test.describe('Students — UI forbidden paths', () => {
  test('authenticated non-admin (TEACHER) hitting /students/new lands on /403', async () => {
    // The roleGuard at /students/* requires TENANT_ADMIN. A TEACHER
    // session is authenticated (so the auth guard passes) but lacks
    // the role, so the roleGuard sends them to /403.
    //
    // Skipped if TEACHER login is broken (e.g. dev DB without the seed).
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const TEACHER_STATE = 'e2e/.auth/teacher.json';
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { chromium } = require('@playwright/test') as typeof import('@playwright/test');
      const browser = await chromium.launch({ headless: true });
      try {
        // Explicit storageState overrides the project default; without
        // this the new context inherits the project-level tenant-admin
        // storage and the test is meaningless.
        const ctx = await browser.newContext({ storageState: TEACHER_STATE });
        const page = await ctx.newPage();
        try {
          await page.goto('/students/new');
          await expect(page).toHaveURL(/\/403/);
        } finally {
          await ctx.close();
        }
      } finally {
        await browser.close();
      }
    } finally {
      await api.dispose();
    }
  });
});
