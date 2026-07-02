import { APIRequestContext, request } from '@playwright/test';
import { SeedUser } from '../fixtures/test-users';

/**
 * Lightweight client for the EduShift backend, used by Playwright
 * to skip the login form and seed data without round-tripping the UI
 * (Sprint 12 / FE-12.2).
 *
 * <h3>Why direct API and not the UI</h3>
 * <ul>
 *   <li>Speed: one HTTP POST per login, vs. typing through a form
 *       and waiting for routing transitions.</li>
 *   <li>Stability: the auth flow is already covered by the
 *       {@code auth.spec.ts} e2e test. Re-using the form everywhere
 *       would couple every test to the form's flake, multiplying
 *       debugging cost.</li>
 *   <li>Seed setup: tests that need "an admin with X invoices paid"
 *       can hit the real {@code POST /payments/...} endpoint, which
 *       is the same path the FE uses — no parallel test-only API
 *       to maintain.</li>
 * </ul>
 *
 * <h3>Why not just use the FE's own AuthService</h3>
 * Playwright runs in a Node process outside the Angular bundle. Pulling
 * the FE's services would require building a separate artifact or
 * running the dev server in test mode — both add complexity for no
 * benefit.
 */
export const API_BASE = process.env['API_URL'] ?? 'http://localhost:8080/api';

export interface ApiContextOptions {
  /** When true, the returned context is bound to the tenant slug. */
  user: SeedUser;
  /** Optional baseURL override (defaults to {@link API_BASE}). */
  baseURL?: string;
}

/**
 * Returns a Playwright {@link APIRequestContext} with the bearer
 * token and tenant slug already set as defaults, so the caller can
 * just call {@code api.post(...)} without repeating headers.
 */
export async function apiContextFor(opts: ApiContextOptions): Promise<APIRequestContext> {
  const baseURL = opts.baseURL ?? API_BASE;
  const session = await loginViaApi(baseURL, opts.user);
  return request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-Tenant-Slug': opts.user.tenantSlug,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSec: number;
  user: {
    publicUuid: string;
    email: string;
    role: string;
  };
}

async function loginViaApi(baseURL: string, user: SeedUser): Promise<LoginResponse> {
  const ctx = await request.newContext({ baseURL });
  try {
    const res = await ctx.post('/v1/auth/login', {
      headers: {
        'X-Tenant-Slug': user.tenantSlug,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      data: { email: user.email, password: user.password },
    });
    if (!res.ok()) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Login API failed for ${user.email} on tenant ${user.tenantSlug}: ` +
          `${res.status()} ${res.statusText()}\n${body}`,
      );
    }
    return (await res.json()) as LoginResponse;
  } finally {
    await ctx.dispose();
  }
}
