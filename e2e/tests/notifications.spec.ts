import { test, expect, request as pwRequest } from '@playwright/test';
import { apiContextFor } from '../utils/api-helpers';
import { TENANT_ADMIN } from '../fixtures/test-users';
import { TENANT_ADMIN_STORAGE_STATE } from '../fixtures/storage-state-paths';

/**
 * Notifications end-to-end spec (Sprint 13 / FE-13.1).
 *
 * <p>Covers the critical user path: bell shows unread count, clicking
 * the bell opens a dropdown with the latest notifications, marking one
 * as read decrements the badge in real time, and the home page
 * ({@code /notifications}) renders the same list.</p>
 *
 * <h3>Seeding strategy</h3>
 * <p>The dev profile ({@code DevDataInitializer}) does <em>not</em> seed
 * notifications — only users, tenants, courses, students, etc. To
 * exercise the UI we POST a small batch of notifications directly to
 * the backend through {@code apiContextFor}, which is the same
 * authenticated channel the FE uses. This keeps the test honest:
 * whatever the FE would see at runtime, the test sees too.</p>
 *
 * <h3>Test isolation</h3>
 * <p>Each test seeds its own notifications with a unique tag and only
 * asserts against that tag, so two tests in the same suite (or across
 * suites) never collide. There is no global cleanup; the test DB
 * ({@code demo} profile) is wiped on backend restart.</p>
 */
test.describe('Notifications — bell + unread count + mark-read', () => {
  test.use({ storageState: TENANT_ADMIN_STORAGE_STATE });

  // ----------------------------------------------------------------- helpers

  /** Seed a notification directly to the backend so the bell/list have data. */
  async function seedNotification(
    title: string,
    body: string,
    category: string = 'ANNOUNCEMENT',
  ): Promise<void> {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      // /v1/notifications/seed is intentionally NOT a public endpoint. We
      // use the admin /announcements publish flow as the realistic path:
      // create a DRAFT and then publish. The publish step materializes
      // AnnouncementRecipient rows + dispatches in-app notifications.
      const create = await api.post('/api/v1/announcements', {
        data: {
          title,
          bodyHtml: `<p>${body}</p>`,
          audienceType: 'SCHOOL',
          pinned: false,
        },
      });
      // Whether or not the announcement is created (depends on perms), the
      // bell will eventually show seeded notifications if we hit
      // /v1/notifications/seed (dev-only). The dev profile exposes it for
      // exactly this purpose.
      if (!create.ok()) {
        // Fallback: hit the dev-only seed endpoint that the dev profile
        // exposes. In production, the endpoint is removed by @Profile.
        const seed = await api.post('/api/v1/notifications/seed', {
          data: { title, body, category },
        });
        expect(seed.ok(), `seed notification failed: ${seed.status()}`).toBe(true);
      }
    } finally {
      await api.dispose();
    }
  }

  // ----------------------------------------------------------------- tests

  test('bell badge appears with unread count when there are notifications', async ({ page }) => {
    // Seed two notifications so the badge is deterministic (>= 1, up to 2).
    await seedNotification('e2e-A: ' + Date.now(), 'Mensaje uno');
    await seedNotification('e2e-B: ' + Date.now(), 'Mensaje dos');

    await page.goto('/dashboard');

    // Wait for the bell to mount and load. The NotificationBellComponent
    // is in the top bar (toolbar) and uses aria-label="Notificaciones".
    const bell = page.getByRole('button', { name: /Notificaciones/i });
    await expect(bell).toBeVisible({ timeout: 10_000 });

    // The badge is rendered as a counter inside the bell — the simplest
    // selector is to look for any non-zero number in the bell button.
    // We use a regex matcher so 1, 2, ... 9, 10, ... all pass.
    await expect(bell).toContainText(/\d+/, { timeout: 5_000 });
  });

  test('clicking the bell opens the dropdown with the seeded notifications', async ({ page }) => {
    const tag = 'e2e-dropdown-' + Date.now();
    await seedNotification(tag, 'Listado en el dropdown');

    await page.goto('/dashboard');
    const bell = page.getByRole('button', { name: /Notificaciones/i });
    await expect(bell).toBeVisible({ timeout: 10_000 });

    // Wait until the badge has loaded (count > 0), then open the dropdown.
    await expect(bell).toContainText(/\d+/, { timeout: 5_000 });
    await bell.click();

    // The dropdown lists the last 5; assert the unique tag is among them.
    await expect(page.getByText(tag)).toBeVisible({ timeout: 5_000 });
  });

  test('marking a notification as read decrements the badge', async ({ page }) => {
    const tag = 'e2e-read-' + Date.now();
    await seedNotification(tag, 'Marcar como leído');

    await page.goto('/dashboard');
    const bell = page.getByRole('button', { name: /Notificaciones/i });
    await expect(bell).toBeVisible({ timeout: 10_000 });
    await expect(bell).toContainText(/\d+/, { timeout: 5_000 });

    const beforeText = (await bell.textContent()) ?? '';
    const beforeCount = Number((beforeText.match(/\d+/) ?? ['0'])[0]);
    expect(beforeCount, 'precondition: at least one unread').toBeGreaterThan(0);

    // Open the dropdown and click the first item to mark it read.
    await bell.click();
    const item = page.getByText(tag).first();
    await expect(item).toBeVisible({ timeout: 5_000 });
    await item.click();

    // The dropdown may close on click; the badge must drop by exactly 1.
    await expect(bell).not.toContainText(String(beforeCount), { timeout: 5_000 });
    const afterText = (await bell.textContent()) ?? '';
    const afterCount = Number((afterText.match(/\d+/) ?? ['0'])[0]);
    expect(afterCount).toEqual(beforeCount - 1);
  });

  test('the /notifications home page renders the H1 and lists the seeded items', async ({ page }) => {
    const tag = 'e2e-home-' + Date.now();
    await seedNotification(tag, 'Visible en home');

    await page.goto('/notifications');

    await expect(
      page.getByRole('heading', { name: /Notificaciones/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Home page is paginated; the freshly seeded item should appear in
    // page 0 if unread, or after marking-read in page > 0. We don't mark
    // here, so the unread filter (or "all" default) must include it.
    await expect(page.getByText(tag)).toBeVisible({ timeout: 10_000 });
  });
});

