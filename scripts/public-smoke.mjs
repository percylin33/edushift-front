import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const baseUrl = new URL(process.env.SMOKE_BASE_URL ?? 'http://demo.localhost:4200');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.SMOKE_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.SMOKE_CHROMIUM_EXECUTABLE }
    : {}),
});
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();
const pageErrors = [];
const failedAssets = [];

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => {
  const url = new URL(response.url());
  if (
    url.origin === baseUrl.origin &&
    /\.(?:js|css)$/.test(url.pathname) &&
    response.status() >= 400
  ) {
    failedAssets.push(`${response.status()} ${url.pathname}`);
  }
});

try {
  await page.route('**/api/v1/tenants/by-slug/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          publicUuid: '00000000-0000-4000-8000-000000000001',
          name: 'EduShift Smoke',
          slug: 'demo',
          status: 'ACTIVE',
          branding: {},
        },
      }),
    }),
  );

  const loginResponse = await page.goto(new URL('/auth/login', baseUrl).href, {
    waitUntil: 'domcontentloaded',
  });
  assert.equal(loginResponse?.status(), 200, 'login route must return HTTP 200');
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor({ state: 'visible' });
  assert.ok((await page.locator('app-root').count()) === 1, 'Angular root must render');

  const loginUrl = page.url();
  const onboardingResponse = await page.goto(new URL('/onboarding/welcome', baseUrl).href, {
    waitUntil: 'domcontentloaded',
  });
  assert.equal(onboardingResponse?.status(), 200, 'onboarding deep link must return HTTP 200');
  await page.getByRole('heading', { name: 'Iniciar sesión' }).waitFor({ state: 'visible' });
  assert.match(page.url(), /\/auth\/login(?:\?|$)/, 'anonymous onboarding must return to login');
  assert.match(page.url(), /returnUrl=/, 'login redirect must preserve the onboarding destination');
  assert.notEqual(page.url(), loginUrl, 'onboarding should produce its protected-route redirect');

  assert.deepEqual(failedAssets, [], 'same-origin JavaScript and CSS must load successfully');
  assert.deepEqual(pageErrors, [], 'public-route smoke must not emit uncaught browser errors');
  console.log(
    'Public smoke passed: login and protected onboarding routes render; lazy assets load.',
  );
} finally {
  await context.close();
  await browser.close();
}
