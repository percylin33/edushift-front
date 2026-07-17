import { type Page, type APIRequestContext } from '@playwright/test';
import { SeedUser } from './test-users';
import { apiContextFor } from '../utils/api-helpers';

/**
 * Shared login-then-persist helper used by both the project-level
 * {@code auth.setup.ts} and the on-demand {@code auth-states.ts}.
 *
 * <p>Extracted so the setup file (runs once, project-wide) and the
 * per-spec on-demand helper share the exact same encoding — see the
 * lesson in {@code docs/qa/migrations-lessons.md} about JSON-stringify
 * round-tripping.</p>
 */

export interface WriteAuthStateOpts {
  /** Optional probe — if true, hit /auth/me first to verify the token. */
  probeMe?: boolean;
}

/**
 * Logs in via {@code /api/v1/auth/login} from inside a Playwright
 * page, persists the JWT, refresh token, tenant slug, and UserSummary
 * to {@code out}, then writes the page's storage state to the same
 * file. The encoding mirrors what the FE's {@code StorageService} does
 * on read (JSON.parse), so direct setItem with raw JWTs would fail.
 */
export async function writeAuthState(
  page: Page,
  baseURL: string | undefined,
  user: SeedUser,
  out: string,
  opts: WriteAuthStateOpts = {},
): Promise<void> {
  await page.goto(baseURL ?? '/');

  const result = await page.evaluate(async (creds) => {
    const r = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'X-Tenant-Slug': creds.tenantSlug,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
    if (!r.ok) {
      return {
        ok: false as const,
        status: r.status,
        statusText: r.statusText,
        body: await r.text().catch(() => ''),
      };
    }
    const data = await r.json();
    localStorage.setItem('edushift.auth.token', JSON.stringify(data.accessToken));
    localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(data.refreshToken));
    localStorage.setItem('edushift.tenant.current', JSON.stringify(creds.tenantSlug));
    if (data.user) {
      localStorage.setItem('edushift.auth.user', JSON.stringify(data.user));
    }
    return { ok: true as const };
  }, user);

  if (!result.ok) {
    throw new Error(
      `Login failed for ${user.email} on tenant ${user.tenantSlug}: ` +
        `${result.status} ${result.statusText} — ${result.body}`,
    );
  }

  await page.context().storageState({ path: out });
}

/**
 * Server-side login — does NOT use a browser. Useful for specs that
 * only need an {@link APIRequestContext} with a Bearer token (no DOM).
 *
 * <p>Mirrors the FE encoding so that the same login response can be
 * used both for {@code storageState} (FE) and {@code apiContextFor}
 * (BE).</p>
 */
export async function loginViaApi(api: APIRequestContext, user: SeedUser): Promise<{
  accessToken: string;
  refreshToken: string;
  user: { publicUuid: string; email: string };
}> {
  const res = await api.post('/api/v1/auth/login', {
    headers: { 'X-Tenant-Slug': user.tenantSlug, 'Content-Type': 'application/json' },
    data: { email: user.email, password: user.password },
  });
  if (!res.ok()) {
    throw new Error(`loginViaApi failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const data = body.data ?? body;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
}
