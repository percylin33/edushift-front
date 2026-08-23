import { request, type APIRequestContext } from '@playwright/test';
import { SUPER_ADMIN } from './admin-users';

/**
 * SUPER_ADMIN login for Playwright (dev/local).
 *
 * <p>{@code POST /admin/login} returns either a full session (MFA already
 * enrolled) or an {@code onboardingToken}. In the latter case we call the
 * profile-gated {@code POST /admin/dev/complete-mfa} with
 * {@code X-Dev-Code} (default {@code dev-bypass}).</p>
 */

export interface SuperAdminSession {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  user: {
    publicUuid: string;
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    roles?: string[];
  };
}

function apiRoot(): string {
  return (process.env['API_URL'] ?? 'http://localhost:8080').replace(/\/api\/?$/, '');
}

function unwrap<T extends Record<string, unknown>>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body && (body as { data: unknown }).data) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/**
 * Obtain a SUPER_ADMIN bearer session, completing MFA enrolment via the
 * dev bypass when needed. Retries once after 65s on admin login rate-limit.
 */
export async function loginSuperAdminSession(
  api?: APIRequestContext,
): Promise<SuperAdminSession> {
  const owns = !api;
  const ctx = api ?? (await request.newContext({ baseURL: apiRoot() }));
  try {
    return await loginSuperAdminSessionOnce(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|TOO_MANY_LOGIN_ATTEMPTS|Retry in 60/.test(msg)) {
      await new Promise((r) => setTimeout(r, 65_000));
      return await loginSuperAdminSessionOnce(ctx);
    }
    throw e;
  } finally {
    if (owns) await ctx.dispose();
  }
}

async function loginSuperAdminSessionOnce(
  ctx: APIRequestContext,
): Promise<SuperAdminSession> {
  const loginRes = await ctx.post('/api/v1/admin/login', {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    data: { email: SUPER_ADMIN.email, password: SUPER_ADMIN.password },
  });
  if (!loginRes.ok()) {
    throw new Error(
      `SA login failed: ${loginRes.status()} ${await loginRes.text()}`,
    );
  }
  const loginBody = unwrap<Record<string, unknown>>(await loginRes.json());

  if (typeof loginBody['accessToken'] === 'string' && loginBody['accessToken']) {
    return normalizeSession(loginBody);
  }

  const onboardingToken =
    (loginBody['onboardingToken'] as string | undefined) ?? undefined;
  if (!onboardingToken) {
    throw new Error(
      `SA login returned neither accessToken nor onboardingToken: ${JSON.stringify(loginBody)}`,
    );
  }

  const enrolRes = await ctx.post('/api/v1/admin/dev/complete-mfa', {
    headers: {
      Authorization: `Bearer ${onboardingToken}`,
      'X-Dev-Code': process.env['EDUSHIFT_DEV_MFA_BYPASS_CODE'] ?? 'dev-bypass',
      Accept: 'application/json',
    },
  });
  if (enrolRes.status() === 404) {
    throw new Error(
      'SA MFA bypass 404 — backend not running with dev/local profile',
    );
  }
  if (!enrolRes.ok()) {
    throw new Error(
      `SA MFA bypass failed: ${enrolRes.status()} ${await enrolRes.text()}`,
    );
  }
  const enrolBody = unwrap<Record<string, unknown>>(await enrolRes.json());
  const session =
    (enrolBody['session'] as Record<string, unknown> | undefined) ?? enrolBody;
  if (typeof session['accessToken'] !== 'string' || !session['accessToken']) {
    throw new Error(
      `SA MFA bypass returned no session.accessToken: ${JSON.stringify(enrolBody)}`,
    );
  }
  return normalizeSession(session);
}

function normalizeSession(raw: Record<string, unknown>): SuperAdminSession {
  const userRaw = (raw['user'] as Record<string, unknown> | undefined) ?? {};
  return {
    accessToken: String(raw['accessToken']),
    refreshToken: String(raw['refreshToken'] ?? ''),
    expiresInSec: Number(raw['expiresInSec'] ?? 900),
    user: {
      publicUuid: String(userRaw['publicUuid'] ?? ''),
      email: String(userRaw['email'] ?? SUPER_ADMIN.email),
      firstName: userRaw['firstName'] as string | undefined,
      lastName: userRaw['lastName'] as string | undefined,
      fullName: userRaw['fullName'] as string | undefined,
      roles: (userRaw['roles'] as string[] | undefined) ?? ['SUPER_ADMIN'],
    },
  };
}
