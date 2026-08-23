import { test, expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ALL_SMOKE_ROLES,
  expectationsFor,
  ROUTE_SMOKE_MATRIX,
  STORAGE_BY_ROLE,
  type RouteSmokeEntry,
  type SmokeExpectation,
  type SmokeRole,
} from '../../fixtures/route-matrix';
import { SUPER_ADMIN_STORAGE_STATE } from '../../fixtures/storage-state-paths';

/**
 * Role × route smoke — data-driven from {@link ROUTE_SMOKE_MATRIX}.
 *
 * <p>Covers all roles in {@link ALL_SMOKE_ROLES} (anonymous + 6 authenticated).
 * Project default storageState is tenant-admin; each role describe overrides
 * via {@code test.use}. Parallel within role so one failure does not skip the matrix.</p>
 *
 * <p>Requires {@code setup}. {@code admin-setup} is best-effort: when SUPER_ADMIN
 * MFA/rate-limit skips, the SA describe is skipped (stale storage would false-fail).</p>
 */
test.describe('Role route smoke @smoke', () => {
  for (const role of ALL_SMOKE_ROLES) {
    test.describe(`role: ${role}`, () => {
      test.describe.configure({ mode: 'parallel' });

      if (role === 'anonymous') {
        test.use({ storageState: { cookies: [], origins: [] } });
      } else {
        test.use({ storageState: STORAGE_BY_ROLE[role] });
      }

      if (role === 'super-admin') {
        test.beforeAll(() => {
          test.skip(
            !isUsableSuperAdminStorage(),
            'SUPER_ADMIN storage missing/expired or admin-setup skipped (MFA/rate-limit)',
          );
        });
      }

      for (const entry of ROUTE_SMOKE_MATRIX) {
        const expected = expectationsFor(entry, role);
        if (expected === undefined) {
          continue;
        }

        test(`${role} → ${entry.path} expects ${expected}`, async ({ page }) => {
          await page.goto(entry.path, { waitUntil: 'domcontentloaded', timeout: 15_000 });
          try {
            await page.waitForLoadState('networkidle', { timeout: 15_000 });
          } catch {
            await page.waitForLoadState('load', { timeout: 15_000 });
          }
          await assertSmokeExpectation(page, entry, role, expected);
        });
      }
    });
  }
});

/** Stale SA JSON from a prior host (e.g. :4200) or expired JWT must not run the matrix. */
function isUsableSuperAdminStorage(): boolean {
  const file = path.resolve(SUPER_ADMIN_STORAGE_STATE);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      origins?: Array<{ origin: string; localStorage?: Array<{ name: string; value: string }> }>;
    };
    const base = process.env['BASE_URL'] ?? 'http://localhost:4200';
    const origin = new URL(base).origin;
    const entry = raw.origins?.find((o) => o.origin === origin);
    const ls = entry?.localStorage ?? [];
    const read = (name: string): string | null => {
      const v = ls.find((i) => i.name === name)?.value;
      if (v == null || v === '') return null;
      try {
        const parsed = JSON.parse(v) as unknown;
        return typeof parsed === 'string' ? parsed : v;
      } catch {
        return v;
      }
    };
    const expires = read('edushift.auth.expiresAt');
    const token = read('edushift.auth.token');
    if (!token || !expires) return false;
    return Date.parse(expires) > Date.now() + 60_000;
  } catch {
    return false;
  }
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isGuestRoute(path: string): boolean {
  return (
    path.startsWith('/auth/') ||
    path === '/admin/login' ||
    path === '/onboarding' ||
    path.startsWith('/onboarding/')
  );
}

async function assertSmokeExpectation(
  page: Page,
  entry: RouteSmokeEntry,
  _role: SmokeRole,
  expected: SmokeExpectation,
): Promise<void> {
  const url = new URL(page.url());
  const finalPath = normalizePath(url.pathname);
  const entryPath = normalizePath(entry.path);

  switch (expected) {
    case 'login': {
      // permissionGuard canMatch often fires before authChildGuard → /403 for anonymous.
      await page.waitForURL(/auth\/login|\/403/, { timeout: 10_000 }).catch(() => undefined);
      expect(
        new URL(page.url()).pathname,
        `${entry.path} should redirect to login or 403 (unauthenticated)`,
      ).toMatch(/auth\/login|\/403/);
      break;
    }

    case 'forbidden': {
      const pathNow = new URL(page.url()).pathname;
      const forbiddenUrl = /\/403|\/404/.test(pathNow);
      const bouncedLogin = /auth\/login/.test(pathNow);
      const pathMarker =
        /403|404/.test(entry.path) && finalPath.includes(entryPath.replace(/^\//, ''));
      expect(
        forbiddenUrl || pathMarker || bouncedLogin,
        `${entry.path} expected forbidden (403/404) or login, got ${pathNow}`,
      ).toBeTruthy();
      break;
    }

    case 'redirect': {
      expect(finalPath, `${entry.path} should leave its path`).not.toBe(entryPath);
      if (!isGuestRoute(entry.path)) {
        expect(url.pathname, `${entry.path} redirect should not land on login`).not.toMatch(
          /auth\/login/,
        );
      }
      break;
    }

    case 'ok': {
      if (!/auth\/login/.test(entry.path)) {
        expect(url.pathname, `${entry.path} should not redirect to login`).not.toMatch(
          /auth\/login/,
        );
      }
      if (!/\/403$/.test(entryPath)) {
        expect(url.pathname, `${entry.path} should not land on 403`).not.toMatch(/\/403/);
      }

      const onPath =
        url.pathname.includes(entry.path) ||
        finalPath === entryPath ||
        finalPath.startsWith(entryPath + '/');
      expect(onPath, `${entry.path} ok URL should stay on route (got ${url.pathname})`).toBeTruthy();

      // Prefer semantic roots; fall back to main shell so empty/loading pages still pass smoke.
      const root = page
        .locator(
          'h1, h2, app-empty-state, form, [data-testid=page-root], [role=alert], app-me-profile, main, [role=main]',
        )
        .first();
      await expect(root, `${entry.path} missing visible page root`).toBeVisible({
        timeout: 10_000,
      });
      break;
    }
  }
}
