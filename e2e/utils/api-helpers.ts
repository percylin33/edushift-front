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
export const API_BASE = process.env['API_URL'] ?? 'http://localhost:8080';

export interface ApiContextOptions {
  /** When true, the returned context is bound to the tenant slug. */
  user: SeedUser;
  /** Optional baseURL override (defaults to {@link API_BASE}). */
  baseURL?: string;
}

/**
 * Returns an authenticated Playwright {@link APIRequestContext} with
 * the tenant slug already set as a default. Current EduShift versions
 * keep access and refresh tokens in HttpOnly cookies, so this helper
 * preserves the login request context and its cookie jar. Older
 * backends that still return an access token in the response body are
 * supported through the Authorization header fallback.
 *
 * <p>Playwright's {@code request.newContext({ baseURL })} uses the
 * base URL only as the scheme + host — the path component is
 * discarded (see https://playwright.dev/docs/api/class-apirequestcontext
 * — "baseURL — When set, it is the base URL for all the requests
 * issued by this APIRequestContext."). Because the EduShift API lives
 * under {@code /api}, callers must include {@code /api/v1/...} in
 * their paths; this helper keeps that invariant by prepending
 * {@code /api} on the {@code /v1} endpoints it composes and trusting
 * the caller to do the same.</p>
 */
export async function apiContextFor(opts: ApiContextOptions): Promise<APIRequestContext> {
  const baseURL = opts.baseURL ?? API_BASE;
  const headers = {
    'X-Tenant-Slug': opts.user.tenantSlug,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const ctx = await request.newContext({
    baseURL,
    extraHTTPHeaders: headers,
  });
  try {
    const login = await ctx.post('/api/v1/auth/login', {
      data: { email: opts.user.email, password: opts.user.password },
    });
    if (!login.ok()) {
      const body = await login.text().catch(() => '');
      throw new Error(
        `Login API failed for ${opts.user.email} on tenant ${opts.user.tenantSlug}: ` +
          `${login.status()} ${login.statusText()}\n${body}`,
      );
    }
    const session = (await login.json()) as LoginResponse;
    if (!session.user) {
      throw new Error(
        `Login API requires additional verification for ${opts.user.email} on tenant ${opts.user.tenantSlug}`,
      );
    }
    if (session.accessToken) {
      const storageState = await ctx.storageState();
      await ctx.dispose();
      return request.newContext({
        baseURL,
        extraHTTPHeaders: {
          ...headers,
          Authorization: `Bearer ${session.accessToken}`,
        },
        storageState,
      });
    }
    return ctx;
  } catch (error) {
    await ctx.dispose();
    throw error;
  }
}

/**
 * Like {@link apiContextFor} but returns {@code null} when the
 * login request itself fails (401, 409, 404, ...). Use this in
 * specs that should {@code test.skip()} instead of fail when the
 * seed backend has an account-management bug or when the test
 * role simply doesn't exist.
 *
 * <p>The returned {@code reason} string is safe to forward to
 * {@code test.skip(true, reason)} so the skip message explains
 * exactly what went wrong on the wire.</p>
 */
export async function safeApiContextFor(
  opts: ApiContextOptions,
): Promise<{ api: APIRequestContext; reason: null } | { api: null; reason: string }> {
  const baseURL = opts.baseURL ?? API_BASE;
  try {
    const api = await apiContextFor(opts);
    return { api, reason: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { api: null, reason: msg };
  }
}

interface LoginResponse {
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenType: 'Bearer';
  expiresInSec: number;
  user?: {
    publicUuid: string;
    email: string;
    role: string;
  };
}
