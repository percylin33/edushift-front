import { Page, Locator, expect } from '@playwright/test';

/**
 * DOM helpers for resilient Playwright assertions.
 *
 * <p>The default {@link expect(locator).toBeVisible()} fails immediately
 * if the element isn't there yet. For SPA navigations where Angular
 * may still be hydrating, route guards may be re-evaluating, or a
 * lazy chunk is being downloaded, this trips flaky failures.</p>
 *
 * <p>Use {@link expectVisible} (or {@link expectAttached}) with an
 * explicit timeout when the element is expected but may take a beat
 * to mount. Keep the {@link defaultExpectTimeout} small so genuine
 * regressions surface quickly.</p>
 */

export const defaultExpectTimeout = 10_000;

/**
 * Like {@link expect(locator).toBeVisible()} but with a configurable
 * timeout. Use this anywhere the assertion can race with the SPA's
 * own navigation / hydration work.
 */
export async function expectVisible(locator: Locator, timeout = defaultExpectTimeout): Promise<void> {
  await expect(locator).toBeVisible({ timeout });
}

/**
 * Asserts the locator is attached to the DOM (does not require
 * visibility). Useful for skeleton / hidden states where the
 * element exists but is invisible.
 */
export async function expectAttached(locator: Locator, timeout = defaultExpectTimeout): Promise<void> {
  await expect(locator).toHaveCount(1, { timeout });
}

/**
 * Poll until {@link predicate} returns truthy, or until {@link timeout}
 * expires. Returns the last observed value (or undefined on timeout).
 *
 * <p>Use this for SSE / polling assertions where the response arrives
 * asynchronously and there's no DOM signal to wait on.</p>
 */
export async function pollUntil<T>(
  predicate: () => Promise<T | undefined> | T | undefined,
  options: { timeout?: number; interval?: number; description?: string } = {},
): Promise<T | undefined> {
  const timeout = options.timeout ?? defaultExpectTimeout;
  const interval = options.interval ?? 250;
  const deadline = Date.now() + timeout;
  let last: T | undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    last = await predicate();
    if (last) return last;
    if (Date.now() > deadline) {
      console.warn(`[pollUntil] timed out after ${timeout}ms — ${options.description ?? ''}`);
      return undefined;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

/**
 * Convenience: navigate and wait for the URL to match a regex.
 * Replaces the common `await page.goto(); await expect(page).toHaveURL(...)`
 * pair with a single call that fails late if the URL doesn't arrive.
 */
export async function navigateAndWait(
  page: Page,
  url: string,
  urlRegex: RegExp,
  options: { timeout?: number } = {},
): Promise<void> {
  await page.goto(url);
  await expect(page).toHaveURL(urlRegex, { timeout: options.timeout ?? defaultExpectTimeout });
}

/**
 * Wait for a {@link response} matching the predicate, with timeout.
 * Used to capture SSE chunks or async webhook deliveries during a spec.
 */
export async function waitForResponse(
  page: Page,
  predicate: (r: { url(): string; status(): number }) => boolean,
  options: { timeout?: number; description?: string } = {},
): Promise<{ url(): string; status(): number; text(): () => Promise<string>; body(): Promise<Buffer> } | null> {
  const timeout = options.timeout ?? defaultExpectTimeout;
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[waitForResponse] timed out after ${timeout}ms — ${options.description ?? ''}`);
      resolve(null);
    }, timeout);
    page.on('response', (r) => {
      if (predicate(r)) {
        clearTimeout(timer);
        resolve(r as unknown as { url(): string; status(): number; text(): () => Promise<string>; body(): Promise<Buffer> });
      }
    });
  });
}
