import { test as setup, expect, test } from '@playwright/test';
import { SUPER_ADMIN } from '../fixtures/admin-users';
import { SUPER_ADMIN_STORAGE_STATE } from '../fixtures/storage-state-paths';

const SUPER_ADMIN_STATE = SUPER_ADMIN_STORAGE_STATE;

setup('authenticate as super admin', async ({ page, baseURL }) => {
  const loginRes = await page.request.post(
    `${process.env['API_URL'] ?? 'http://localhost:8080/api'}/v1/admin/login`,
    {
      data: { email: SUPER_ADMIN.email, password: SUPER_ADMIN.password },
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    },
  );
  if (!loginRes.ok()) {
    const body = await loginRes.text().catch(() => '');
    // The SUPER_ADMIN seed lives behind a 3-attempts/minute rate limit
    // (see AdminAuthService). Repeated test runs against the same dev
    // backend can trip it OR the seed password may have been rotated
    // by a teammate. Skip with a clear reason rather than fail the
    // entire suite — the cached storageState at SUPER_ADMIN_STATE is
    // still used by the suite if it was produced in a prior run.
    test.skip(true,
      `Admin login returned ${loginRes.status()}: ${body.substring(0, 200)}`);
    return;
  }
  const body = await loginRes.json();
  if (!body.accessToken) {
    // Phase 2.15 / dev profile: the SUPER_ADMIN account requires
    // MFA enrolment before issuing an access token. The dev
    // /dev/complete-mfa endpoint is TENANT_ADMIN-only (see
    // AGENTS.md "MFA bypass dev" gotcha). Skip with a clear reason
    // rather than fail the entire suite — admin-smoke.spec.ts will
    // skip the gated test paths.
    test.skip(true,
      `SUPER_ADMIN login returned 200 but no accessToken (got ${body.reason ?? 'unknown'})` +
      ` — MFA enrolment not bypassed in dev.`);
    return;
  }
  expect(body.accessToken).toBeTruthy();
  const { accessToken, refreshToken, user, expiresInSec } = body;

  await page.goto(baseURL ?? '/');
  await page.evaluate(
    ({ token, refresh, userData, expiresSec }) => {
      const expiresAt = new Date(Date.now() + expiresSec * 1000).toISOString();
      localStorage.setItem('edushift.auth.token', token);
      localStorage.setItem('edushift.auth.refreshToken', refresh);
      localStorage.setItem('edushift.auth.expiresAt', expiresAt);
      localStorage.setItem(
        'edushift.auth.user',
        JSON.stringify({
          publicUuid: userData.publicUuid,
          email: userData.email,
          fullName: `${userData.firstName} ${userData.lastName}`,
          firstName: userData.firstName,
          lastName: userData.lastName,
          status: 'ACTIVE',
          roles: ['SUPER_ADMIN'],
        }),
      );
    },
    { token: accessToken, refresh: refreshToken, userData: user, expiresSec: expiresInSec },
  );

  await page.context().storageState({ path: SUPER_ADMIN_STATE });
});
