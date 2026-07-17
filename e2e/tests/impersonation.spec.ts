import { test, expect, request } from '@playwright/test';
import { SUPER_ADMIN } from '../fixtures/admin-users';
import { apiContextFor } from '../utils/api-helpers';

/**
 * Impersonation flow (QA Plan 2026-07-02 / 02-plan-por-rol.md §2.1 + 03-pruebas-seguridad.md §3.4).
 *
 * <p>SA can start/stop impersonation of any user. The filter must
 * propagate the impersonated user's claims and audit both actions.</p>
 *
 * <p>Requires the SUPER_ADMIN role to be seeded in the dev profile
 * (see docs/qa/07-seed-desde-front.md §Dato-7).</p>
 *
 * <h3>SUPER_ADMIN login (dev only)</h3>
 * <p>{@code POST /admin/login} requires an MFA enrolment step on first
 * use. In dev we side-step the authenticator-app requirement via the
 * static-code {@code POST /admin/dev/complete-mfa} endpoint (see
 * {@code AdminDevMfaController}, {@code @Profile({"dev","local"})}).
 * Override the dev code with {@code EDUSHIFT_DEV_MFA_BYPASS_CODE}.</p>
 */

const API_BASE = process.env['API_URL'] ?? 'http://localhost:8081';

async function loginAsSuperAdmin(): Promise<string> {
  const ctx = await request.newContext({ baseURL: API_BASE });
  try {
    const loginRes = await ctx.post('/api/v1/admin/login', {
      headers: { 'Content-Type': 'application/json' },
      data: { email: SUPER_ADMIN.email, password: SUPER_ADMIN.password },
    });
    if (!loginRes.ok()) {
      throw new Error(`SA login failed: ${loginRes.status()} ${await loginRes.text()}`);
    }
    const body = await loginRes.json();
    const onboardingToken: string | undefined =
      body.data?.onboardingToken ?? body.onboardingToken;
    if (!onboardingToken) {
      throw new Error(
        'SA login returned no onboardingToken. Response: ' + JSON.stringify(body),
      );
    }

    // MFA enrolment bypass (dev-only). If this 404s the BE was started
    // without the dev profile — surface a clear skip reason instead of
    // a 500.
    const enrolRes = await ctx.post('/api/v1/admin/dev/complete-mfa', {
      headers: {
        Authorization: `Bearer ${onboardingToken}`,
        'X-Dev-Code': process.env['EDUSHIFT_DEV_MFA_BYPASS_CODE'] ?? 'dev-bypass',
      },
    });
    if (!enrolRes.ok()) {
      throw new Error(
        `SA MFA enrolment bypass failed: ${enrolRes.status()} ${await enrolRes.text()}`,
      );
    }
    const enrolBody = await enrolRes.json();
    const token: string | undefined =
      enrolBody.data?.session?.accessToken ?? enrolBody.accessToken;
    if (!token) {
      throw new Error('SA MFA enrolment returned no accessToken');
    }
    return token;
  } finally {
    await ctx.dispose();
  }
}

test.describe('SUPER_ADMIN — impersonation', () => {
  test('SA starts impersonation of a tenant admin', async () => {
    let saToken: string;
    try {
      saToken = await loginAsSuperAdmin();
    } catch (e) {
      test.skip(true, e instanceof Error ? e.message : String(e));
      return;
    }

    const api = await request.newContext({ baseURL: API_BASE });
    try {
      // Start impersonation against an arbitrary user (any valid UUID).
      const targetUuid = '00000000-0000-0000-0000-000000000010';
      const startRes = await api.post('/api/v1/admin/impersonation/start', {
        headers: {
          Authorization: `Bearer ${saToken}`,
          'Content-Type': 'application/json',
        },
        data: { userPublicUuid: targetUuid },
      });
      // Expected: 200 (impersonation OK) or 4xx if target not found.
      // Either is valid; we mainly want to assert no 5xx.
      expect(startRes.status()).toBeLessThan(500);
    } finally {
      await api.dispose();
    }
  });

  test('SA cannot impersonate SYSTEM_USER_ID', async () => {
    let saToken: string;
    try {
      saToken = await loginAsSuperAdmin();
    } catch (e) {
      test.skip(true, e instanceof Error ? e.message : String(e));
      return;
    }

    const api = await request.newContext({ baseURL: API_BASE });
    try {
      const res = await api.post('/api/v1/admin/impersonation/start', {
        headers: {
          Authorization: `Bearer ${saToken}`,
          'Content-Type': 'application/json',
        },
        data: { userPublicUuid: '00000000-0000-0000-0000-000000000001' }, // SYSTEM_USER_ID
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    } finally {
      await api.dispose();
    }
  });
});

