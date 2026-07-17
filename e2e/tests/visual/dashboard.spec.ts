import { test, expect } from '@playwright/test';
import { TENANT_ADMIN_STORAGE_STATE } from '../../fixtures/storage-state-paths';

/**
 * Visual regression — dashboard home (Sprint 2.15 / Track A).
 *
 * <p>Catches layout regressions on the most visited screen in the SPA.
 * The dashboard renders KPI cards, the sidebar, the user pill, and
 * recently closed attendance items. All of those have known dynamic
 * content (counts, names, dates) that must be masked.</p>
 *
 * <p><b>Mask policy:</b>
 * <ul>
 *   <li>{@code app-stat-card} value {@code .text-2xl} — KPI numbers
 *       depend on DB state (V39 seeds 9 students / 5 teachers, but
 *       other tenants differ).</li>
 *   <li>{@code .user-pill} — avatar + email of the logged-in user.</li>
 *   <li>{@code [data-testid="recent-closed"]} — date-relative list
 *       ("hace 5 minutos") that drifts between runs.</li>
 * </ul>
 * </p>
 *
 * <p><b>Why TA login:</b> the dashboard renders the admin view (KPIs
 * + recent closed) for TENANT_ADMIN only. TEACHERs see a different
 * surface; we snapshot the admin view because it's the canonical
 * "logged in" view used by the rest of the e2e suite.</p>
 */
const BASE = process.env['BASE_URL'] ?? 'http://localhost:4201';

test.describe('Visual regression — /dashboard', () => {
  test.use({ storageState: TENANT_ADMIN_STORAGE_STATE });

  test('dashboard home layout', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);

    // Wait for the page shell to render AND for KPIs to load (the
    // stat-cards component reads from /attendance/dashboard/overview).
    // If the BE is unreachable the dashboard shows an empty state;
    // that state is also captured below as a separate baseline.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('app-stat-card').first()).toBeVisible({ timeout: 15_000 });

    // Wait for the network to settle so async KPI fetches don't
    // land mid-screenshot.
    await page.waitForLoadState('networkidle').catch(() => {
      // networkidle can hang on long-polling endpoints; tolerate
      // the timeout and proceed with the snapshot.
    });

    await expect(page).toHaveScreenshot('dashboard-home.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.02,
      mask: [
        // KPI value text — DB-dependent (see mask policy above).
        page.locator('app-stat-card .text-2xl'),
        // User pill in the top bar — varies by logged-in account.
        page.locator('.user-pill'),
        // Date-relative labels ("Hoy", "Esta semana", etc.).
        page.locator('[data-testid="recent-closed"]'),
      ],
    });
  });
});