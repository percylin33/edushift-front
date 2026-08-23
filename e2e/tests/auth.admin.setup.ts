import { test as setup, expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import { SUPER_ADMIN_STORAGE_STATE } from '../fixtures/storage-state-paths';
import { loginSuperAdminSession } from '../fixtures/super-admin-login';

const SUPER_ADMIN_STATE = SUPER_ADMIN_STORAGE_STATE;

/**
 * Persist SUPER_ADMIN storageState for chromium-admin + role-route-smoke.
 *
 * <p>Uses the same MFA enrolment bypass as {@code impersonation.spec.ts}
 * ({@code POST /admin/dev/complete-mfa} + {@code X-Dev-Code}). Tokens are
 * JSON-stringified to match {@code StorageService}.</p>
 *
 * <p>On failure we wipe the storage file so downstream smoke skips SA
 * instead of reusing a stale {@code :4200} / expired JWT.</p>
 */
setup('authenticate as super admin', async ({ page, baseURL }) => {
  let session;
  try {
    session = await loginSuperAdminSession();
  } catch (e) {
    wipeSuperAdminState();
    test.skip(true, e instanceof Error ? e.message : String(e));
    return;
  }

  expect(session.accessToken).toBeTruthy();

  await page.goto(baseURL ?? '/');
  await page.evaluate(
    ({ token, refresh, userData, expiresSec }) => {
      const expiresAt = new Date(Date.now() + expiresSec * 1000).toISOString();
      // Mirror StorageService.set → JSON.stringify every value.
      localStorage.setItem('edushift.auth.token', JSON.stringify(token));
      localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(refresh));
      localStorage.setItem('edushift.auth.expiresAt', JSON.stringify(expiresAt));
      localStorage.setItem(
        'edushift.auth.user',
        JSON.stringify({
          publicUuid: userData.publicUuid,
          email: userData.email,
          fullName:
            userData.fullName ??
            `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim(),
          firstName: userData.firstName ?? 'Super',
          lastName: userData.lastName ?? 'Admin',
          status: 'ACTIVE',
          roles: userData.roles ?? ['SUPER_ADMIN'],
        }),
      );
      // No tenant slug for platform admin — tenantGuard on private routes → /404.
      localStorage.removeItem('edushift.tenant.current');
    },
    {
      token: session.accessToken,
      refresh: session.refreshToken,
      userData: session.user,
      expiresSec: session.expiresInSec,
    },
  );

  await page.context().storageState({ path: SUPER_ADMIN_STATE });
});

function wipeSuperAdminState(): void {
  try {
    fs.writeFileSync(
      SUPER_ADMIN_STATE,
      JSON.stringify({ cookies: [], origins: [] }, null, 2),
      'utf8',
    );
  } catch {
    // ignore — smoke skip still protects via isUsableSuperAdminStorage
  }
}
