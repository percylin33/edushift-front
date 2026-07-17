import { test, expect } from '@playwright/test';

/**
 * Visual regression — onboarding welcome (Sprint 2.15 / Track A).
 *
 * <p>The onboarding flow is the first thing a fresh tenant admin sees
 * after signup. It's a multi-step wizard
 * ({@code /onboarding/welcome → /school → /complete}); we snapshot
 * only the welcome step because the school + complete steps require
 * form input that is unique-per-tenant.</p>
 *
 * <p><b>Mask policy:</b> none — the welcome step is fully static.</p>
 *
 * <p><b>Why no storage state:</b> the onboarding flow is intended
 * for unauthenticated (or just-signed-up) users. Browsing it with
 * the TA storage state would either redirect to /dashboard or
 * render a "ya completaste el onboarding" empty state, neither of
 * which is what we want to snapshot.</p>
 */
const BASE = process.env['BASE_URL'] ?? 'http://localhost:4201';

test.describe('Visual regression — /onboarding/welcome', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('onboarding welcome step layout', async ({ page }) => {
    await page.goto(`${BASE}/onboarding`);

    // The route redirects to /onboarding/welcome. The welcome step
    // renders a heading + a primary CTA — both must be visible
    // before we snapshot.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });

    await expect(page).toHaveScreenshot('onboarding-welcome.png', {
      animations: 'disabled',
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});