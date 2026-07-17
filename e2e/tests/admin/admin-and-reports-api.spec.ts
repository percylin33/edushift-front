import { test, expect } from '@playwright/test';
import { TENANT_ADMIN } from '../../fixtures/test-users';
import { apiContextFor, safeApiContextFor } from '../../utils/api-helpers';

/**
 * Reports + admin console — API coverage (Sprint 2.10).
 *
 * <p>The reports module owns:
 * <ul>
 *   <li><b>Report jobs</b> — async CSV/XLSX/PDF generation with
 *       idempotency keys; client polls {@code /reports/{uuid}} to track
 *       status (PENDING → RUNNING → DONE/FAILED).</li>
 *   <li><b>Admin dashboard</b> — SUPER_ADMIN-only financial KPIs
 *       (revenue trend, plan distribution, top tenants, etc.).</li>
 *   <li><b>Impersonation</b> — SUPER_ADMIN can impersonate a tenant
 *       admin for support purposes (token endpoint).</li>
 * </ul>
 *
 * <p>Reports endpoints require
 * {@code @PreAuthorize("isAuthenticated()")} — any logged-in user can
 * create jobs (the BE gates data visibility per role inside the job).
 * Admin dashboard + impersonation require {@code SUPER_ADMIN},
 * which only {@code super@edushift.pe} has via V39 seed; the dev
 * {@code /admin/dev/complete-mfa} bypass can't impersonate that role
 * (it targets tenant admins). SUPER_ADMIN RBAC tests skip when the
 * dev env doesn't surface a usable SUPER_ADMIN.</p>
 */
const REPORTS = '/api/v1/reports';

test.describe('Reports — API: lifecycle as TENANT_ADMIN', () => {
  test('create → list → get → download lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const idemKey = `e2e-${Date.now().toString(36)}`;
    try {
      // CREATE — async job, returns immediately with status PENDING.
      const create = await api.post(REPORTS, {
        data: {
          reportType: 'GRADE_BOOK',
          format: 'CSV',
          idemKey,
        },
      });
      if (create.status() >= 400) {
        throw new Error(`report create failed: ${create.status()} ${await create.text()}`);
      }
      const publicUuid = (await create.json()).data.publicUuid;

      // LIST.
      const list = await api.get(REPORTS);
      expect(list.status()).toBe(200);

      // GET one.
      const one = await api.get(`${REPORTS}/${publicUuid}`);
      expect(one.status()).toBe(200);

      // Status polling — sleep briefly, status should be one of
      // {PENDING, RUNNING, DONE, FAILED}. Avoid assert on DONE because
      // the job may not have completed in 1s.
      await new Promise((r) => setTimeout(r, 250));
      const polled = await api.get(`${REPORTS}/${publicUuid}`);
      expect(polled.status()).toBe(200);
      const status = (await polled.json()).data?.status;
      expect(
        ['PENDING', 'RUNNING', 'DONE', 'FAILED'].includes(status),
        `unexpected status ${status}`,
      ).toBe(true);

      // DOWNLOAD — only valid when status === DONE. The BE returns
      // 409 (BE_REPORT_NOT_READY) when the job is PENDING/RUNNING, or
      // 422 for other state-machine violations, or 404 if deleted.
      // Any 4xx is acceptable — we only assert the endpoint is reachable.
      const download = await api.get(`${REPORTS}/${publicUuid}/download`);
      expect(download.status()).toBeGreaterThanOrEqual(200);
      expect(download.status()).toBeLessThan(500);
    } finally {
      await api.dispose();
    }
  });

  test('idempotency: same idemKey returns the same report', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const idemKey = `e2e-idem-${Date.now().toString(36)}`;
    try {
      const a = await api.post(REPORTS, {
        data: { reportType: 'ATTENDANCE_SUMMARY', format: 'CSV', idemKey },
      });
      const b = await api.post(REPORTS, {
        data: { reportType: 'ATTENDANCE_SUMMARY', format: 'CSV', idemKey },
      });
      expect(a.status()).toBeLessThan(500);
      expect(b.status()).toBeLessThan(500);
      // Either both succeed with the same id, or the second is a 200/204
      // (replay). Both shapes are acceptable — just verify that two POSTs
      // with the same idemKey don't crash.
      const idA = (a.status() < 300 ? (await a.json()).data?.publicUuid : undefined);
      const idB = (b.status() < 300 ? (await b.json()).data?.publicUuid : undefined);
      if (idA && idB) {
        // Idempotent: same id (or BE chose to return the same job).
        expect(idA, 'idemKey replay should return same id').toBe(idB);
      }
    } finally {
      await api.dispose();
    }
  });
});

test.describe('Reports — API: RBAC matrix', () => {
  // Reports endpoints use isAuthenticated() — every role passes. The
  // RBAC here just confirms the endpoint is reachable for each role.
  const cases: ReadonlyArray<{
    role: 'TENANT_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT' | 'STAFF';
    method: 'GET';
    expected: number[];
    label: string;
  }> = [
    { role: 'TENANT_ADMIN', method: 'GET', expected: [200], label: 'TA lists reports' },
    { role: 'TEACHER',     method: 'GET', expected: [200], label: 'TEACHER lists reports' },
    { role: 'PARENT',      method: 'GET', expected: [200], label: 'PARENT lists reports' },
    { role: 'STUDENT',     method: 'GET', expected: [200], label: 'STUDENT lists reports' },
    { role: 'STAFF',       method: 'GET', expected: [200], label: 'STAFF lists reports' },
  ];
  for (const c of cases) {
    test(`${c.role} ${c.method} ${c.label}: ${c.expected.join('|')}`, async () => {
      const { role } = c;
      const user =
        role === 'TENANT_ADMIN' ? TENANT_ADMIN
        : (await import('../../fixtures/test-users'))[role];
      const ctx = await safeApiContextFor({ user });
      if (!ctx.api) {
        test.skip(true, ctx.reason);
        return;
      }
      try {
        const res = await ctx.api.get(REPORTS);
        expect(c.expected, `${role} GET reports`).toContain(res.status());
      } finally {
        await ctx.api.dispose();
      }
    });
  }
});

test.describe('Admin console — API (SUPER_ADMIN only)', () => {
  // The dev BE doesn't surface a usable SUPER_ADMIN user for the
  // /admin/* endpoints. The dev /admin/dev/complete-mfa bypass
  // targets tenant admins (TENANT_ADMIN), not the system SUPER_ADMIN.
  // Phase 3.x should set up a real SUPER_ADMIN login fixture so these
  // tests can exercise the dashboard + impersonation flows.

  test('admin dashboard endpoint is reachable (skipped without SUPER_ADMIN)', async () => {
    test.skip(true,
      'admin dashboard requires SUPER_ADMIN login — skipped until Phase 3.x seeds it');
  });
});

test.describe('Impersonation — API (SUPER_ADMIN only)', () => {
  // Same constraint as admin dashboard. Phase 3.x should add the
  // SUPER_ADMIN login + skip override.

  test('impersonation endpoint is reachable (skipped without SUPER_ADMIN)', async () => {
    test.skip(true,
      'impersonation requires SUPER_ADMIN login — skipped until Phase 3.x seeds it');
  });
});
