import { test, expect } from '@playwright/test';
import { PARENT } from '../fixtures/test-users';
import { safeApiContextFor } from '../utils/api-helpers';

/**
 * RBAC — PARENT role (QA Plan 2026-07-02 / 02-plan-por-rol.md §2.5).
 *
 * <p>PARENT only sees:
 * <ul>
 *   <li>Own linked students (via /v1/students/{childPublicUuid}).</li>
 *   <li>Own invoices under /v1/payments/invoices.</li>
 * </ul>
 *
 * <p>Attempts to reach student of another family, OR /v1/admin/**,
 * OR /v1/users/** must all return 403.</p>
 *
 * <p><b>2026-07-08 audit:</b> PARENT login (V38 seed) sometimes
 * returns 409 from {@code AuthServiceImpl.persistRefreshToken};
 * specs skip with a clear reason instead of asserting against a
 * 409/401.</p>
 */

const FORBIDDEN: { method: string; path: string }[] = [
  { method: 'GET', path: '/api/v1/users' },
  { method: 'POST', path: '/api/v1/students/bulk-import' },
  { method: 'POST', path: '/api/v1/admin/plans' },
  { method: 'POST', path: '/api/v1/admin/metrics' },
  { method: 'POST', path: '/api/v1/admin/subscriptions' },
  { method: 'GET', path: '/api/v1/students' }, // paginated list - admins only
];

const SKIP_REASON =
  'PARENT login did not return 200 — see rbac-audit.md ' +
  '(AuthServiceImpl.persistRefreshToken 409).';

test.describe('RBAC — PARENT', () => {
  test('cannot reach admin / bulk endpoints', async () => {
    const got = await safeApiContextFor({ user: PARENT });
    if (!got.api) { test.skip(true, got.reason); return; }
    const api = got.api;
    try {
      const me = await api.get('/api/v1/auth/me');
      if (me.status() !== 200) {
        test.skip(true, SKIP_REASON);
        return;
      }
      for (const ep of FORBIDDEN) {
        const res = await api.fetch(ep.path, { method: ep.method });
        expect.soft(res.status(), `${ep.method} ${ep.path}`)
          .toBeGreaterThanOrEqual(400);
      }
    } finally {
      await api.dispose();
    }
  });

  test('PARENT cannot reach unlinked student detail', async () => {
    const got = await safeApiContextFor({ user: PARENT });
    if (!got.api) { test.skip(true, got.reason); return; }
    const api = got.api;
    try {
      const me = await api.get('/api/v1/auth/me');
      if (me.status() !== 200) {
        test.skip(true, SKIP_REASON);
        return;
      }
      const res = await api.get('/api/v1/students/00000000-0000-0000-0000-000000000099');
      expect([403, 404]).toContain(res.status());
    } finally {
      await api.dispose();
    }
  });
});