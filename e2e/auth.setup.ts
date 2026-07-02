import { test as setup, expect } from '@playwright/test';
import { TENANT_ADMIN } from './fixtures/test-users';
import { apiContextFor } from './utils/api-helpers';

/**
 * Auth state bootstrap (Sprint 12 / FE-12.2 / DEBT-FE-E2E-1).
 *
 * <p>Logs in once per role, persists the resulting
 * {@code storageState} JSON, and exports a constant per role so the
 * specs only need to import the path.</p>
 *
 * <p>Why a single setup file (not per-role): the project's current
 * dev seed only has one role (TENANT_ADMIN). When the seed grows to
 * include TEACHER / GUARDIAN, add a parallel {@code test(...)}
 * block here that produces a second state file and a second
 * {@code export const teacherStorageState = ...} — Playwright will
 * just keep adding it to the {@code setup} project.</p>
 *
 * <h3>What gets saved</h3>
 * <p>The setup hits the {@code POST /api/v1/auth/login} endpoint
 * directly. The backend sets the access token in the response body
 * (not as a cookie), and the FE's
 * {@code AuthService.setSession()} is what stores it in
 * {@code localStorage}. We replicate the same write so the
 * subsequent specs find a populated {@code localStorage} on first
 * navigation and skip the login form entirely.</p>
 */
const TENANT_ADMIN_STATE = '.auth/tenant-admin.json';

setup('authenticate as tenant admin', async ({ page, baseURL }) => {
  // We don't need the FE dev server for the API call, but we DO
  // need it for the storageState we save — Playwright snapshots
  // the origin's localStorage from the page, so we must visit at
  // least once to attach the same origin.
  const ctx = await apiContextFor({ user: TENANT_ADMIN });
  // One cheap call to confirm the token works.
  const me = await ctx.get('/v1/auth/me');
  expect(me.ok(), 'auth /me must succeed for the seed user').toBe(true);
  await ctx.dispose();

  // Visit the FE origin so the localStorage write below sticks to
  // the right origin. Using the dev server URL passed via baseURL.
  await page.goto(baseURL ?? '/');
  // Mirror what the FE's AuthService does on login.
  await page.evaluate(async (creds) => {
    const r = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'X-Tenant-Slug': creds.tenantSlug,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
    if (!r.ok) throw new Error('Login failed in auth.setup: ' + r.status);
    const data = await r.json();
    localStorage.setItem('edushift.auth.token', data.accessToken);
    localStorage.setItem('edushift.auth.refreshToken', data.refreshToken);
  }, TENANT_ADMIN);

  await page.context().storageState({ path: TENANT_ADMIN_STATE });
});

export const tenantAdminStorageState = TENANT_ADMIN_STATE;
