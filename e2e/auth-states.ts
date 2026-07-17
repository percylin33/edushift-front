import { test, chromium, type BrowserContext } from '@playwright/test';
import { SeedUser } from './fixtures/test-users';
import { writeAuthState } from './fixtures/_write-auth-state';
import { TENANT_ADMIN_STORAGE_STATE } from './fixtures/storage-state-paths';

/**
 * On-demand storage-state generation per spec.
 *
 * <p>The existing {@code auth.setup.ts} runs once per project and
 * caches the storage state under {@code e2e/.auth/<role>.json}. That
 * works for the parallel-suite case but has a known footgun: if
 * the previous run left a stale {@code edushift.tenant.current}
 * value in the cached JSON, specs that don't override the tenant
 * would inherit the wrong one (see commit history of
 * {@code rbac-audit.md}).</p>
 *
 * <p>{@link freshAuthStateFor} generates a brand-new state file for
 * one specific user, fresh from a live {@code /auth/login}. The
 * returned path can be passed to {@code test.use({ storageState })}.</p>
 *
 * <h3>Usage</h3>
 *
 * <pre>{@code
 * import { freshAuthStateFor, TENANT_ADMIN } from '../auth-states';
 *
 * test('something', async ({ browser }) => {
 *   test.use({ storageState: await freshAuthStateFor(TENANT_ADMIN) });
 *   // ...
 * });
 * </pre>
 *
 * <p>For convenience the top-level roles also expose
 * {@link tenantAdminState}, {@link teacherState}, etc., that return
 * a {@link Promise<string>} suitable for the same use.</p>
 */

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:4201';

/**
 * Launches a chromium browser, logs in via the FE, and persists
 * the resulting storage state to a temp file. Returns the path.
 *
 * <p>The temp file is owned by the caller — clean it up with
 * {@link fs.unlink} if you don't want it to accumulate. In practice
 * Playwright reuses the path across runs, so leaving them is fine.</p>
 */
export async function freshAuthStateFor(user: SeedUser): Promise<string> {
  const tag = `${user.tenantSlug}-${user.email.split('@')[0]}`;
  const safeTag = tag.replace(/[^a-z0-9_-]/gi, '_');
  const path = `e2e/.auth/_fresh-${safeTag}.json`;
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx: BrowserContext = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/`);
    await writeAuthState(page, BASE_URL, user, path);
    await ctx.close();
  } finally {
    await browser.close();
  }
  return path;
}

/** Convenience helpers for the common roles. */
export const tenantAdminState = async (): Promise<string> =>
  freshAuthStateFor((await import('./fixtures/test-users')).TENANT_ADMIN);
export const teacherState = async (): Promise<string> =>
  freshAuthStateFor((await import('./fixtures/test-users')).TEACHER);
export const staffState = async (): Promise<string> =>
  freshAuthStateFor((await import('./fixtures/test-users')).STAFF);
export const parentState = async (): Promise<string> =>
  freshAuthStateFor((await import('./fixtures/test-users')).PARENT);
export const studentState = async (): Promise<string> =>
  freshAuthStateFor((await import('./fixtures/test-users')).STUDENT);

/**
 * Convenience: extend {@code test} so every spec gets a fresh
 * tenant-admin storage state. Use when a spec doesn't care which
 * user it runs as.
 *
 * <pre>{@code
 * import { testAsTenantAdmin } from '../auth-states';
 * testAsTenantAdmin('creates a student', async ({ page }) => { ... });
 * </pre>
 */
/**
 * Convenience helper: a test that automatically uses a fresh
 * tenant-admin storage state.
 *
 * <p>For most use cases prefer the static-state path
 * ({@code test.use({ storageState: 'e2e/.auth/tenant-admin.json' })}) —
 * it's faster and simpler. {@code testAsTenantAdmin} is reserved for
 * specs that must not share cached state with other specs.</p>
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function testAsTenantAdmin(name: string, body: any): void {
  test(name, async ({ browser }) => {
    const path = await tenantAdminState();
    const ctx = await browser.newContext({ storageState: path });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page: any = await ctx.newPage();
      await body(page);
    } finally {
      await ctx.close();
    }
  });
}

export { TENANT_ADMIN_STORAGE_STATE };
