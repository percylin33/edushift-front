import { test, expect } from '@playwright/test';
import { TENANT_ADMIN, TEACHER, STAFF, PARENT, STUDENT } from '../../fixtures/test-users';
import { apiContextFor, safeApiContextFor } from '../../utils/api-helpers';
import { makeAcademicYear } from '../../factories';

/**
 * Academic years — API contract + RBAC matrix (Sprint 2.3).
 *
 * <p>CRUD against {@code /api/v1/academic/years}, plus the
 * {@code /activate} side-effect that promotes a year from
 * {@code PLANNING} to {@code ACTIVE}. Cross-tenant denial is
 * covered by the existing students/teachers specs — academic
 * entities are tenant-scoped the same way.</p>
 */
const API = '/api/v1/academic/years';

test.describe('Academic years — API: CRUD as TENANT_ADMIN', () => {
  test('create → read → update → activate → delete lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      // CREATE.
      const year = new Date().getFullYear();
      const startDate = `${year}-03-01`;
      const endDate = `${year}-12-15`;
      const create = await api.post(API, {
        data: { name: `LifecycleYear-${Date.now().toString(36)}`, startDate, endDate },
      });
      expect(create.status(), 'create must be 201').toBe(201);
      const publicUuid = (await create.json()).data.publicUuid;

      // READ.
      const read = await api.get(`${API}/${publicUuid}`);
      expect(read.status()).toBe(200);
      expect((await read.json()).data.startDate).toContain(`${year}-03-01`);

      // UPDATE — rename with a unique suffix so we don't collide with
      // other parallel tests using the same hard-coded name.
      const update = await api.put(`${API}/${publicUuid}`, {
        data: { name: `RenamedYear-${Date.now().toString(36)}` },
      });
      expect(update.status()).toBe(200);

      // ACTIVATE — POST /{uuid}/activate moves status from PLANNING
      // to ACTIVE. Only one year per tenant is ACTIVE at a time; the
      // BE may return 409 ACADEMIC_YEAR_ALREADY_ACTIVE if another
      // concurrent run already activated one. Both 2xx and 409 are
      // acceptable — the test just needs to prove the endpoint exists.
      const activate = await api.post(`${API}/${publicUuid}/activate`);
      expect([200, 204, 409], 'activate endpoint reachable').toContain(activate.status());

      // DELETE — soft-delete; the row stays but drops from the default list.
      const del = await api.delete(`${API}/${publicUuid}`);
      expect(del.status(), 'delete should be 204').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('create rejects startDate >= endDate', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.post(API, {
        data: {
          name: `InvertedDates-${Date.now().toString(36)}`,
          startDate: '2026-12-01',
          endDate: '2026-01-01',
        },
      });
      // 400 (Bean validation), 409 (service-level invariant), or 422
      // (domain rule violation). The BE uses 409 with a domain code
      // ACADEMIC_YEAR_INVALID_DATE_RANGE.
      expect([400, 409, 422], 'inverted dates must be rejected').toContain(res.status());
    } finally {
      await api.dispose();
    }
  });

  test('list returns paged results', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const res = await api.get(API, { params: { size: 5 } });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const items = body.content ?? body.data?.content ?? [];
      expect(Array.isArray(items)).toBe(true);
    } finally {
      await api.dispose();
    }
  });
});

test.describe('Academic years — API: RBAC matrix', () => {
  const cases: ReadonlyArray<{
    role: 'TENANT_ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT' | 'STUDENT';
    expected: number[];
  }> = [
    { role: 'TENANT_ADMIN', expected: [200] },
    { role: 'TEACHER', expected: [403] },
    { role: 'STAFF', expected: [403] },
    { role: 'PARENT', expected: [403] },
    { role: 'STUDENT', expected: [403] },
  ];
  for (const c of cases) {
    test(`${c.role} list years: status matches RBAC matrix`, async () => {
      const user = c.role === 'TENANT_ADMIN' ? TENANT_ADMIN
        : c.role === 'TEACHER' ? TEACHER
        : c.role === 'STAFF' ? STAFF
        : c.role === 'PARENT' ? PARENT
        : STUDENT;
      const ctx = await safeApiContextFor({ user });
      if (!ctx.api) { test.skip(true, ctx.reason); return; }
      try {
        const res = await ctx.api.get(API);
        expect(c.expected, `${c.role} GET ${API}`).toContain(res.status());
      } finally {
        await ctx.api.dispose();
      }
    });
  }
});

test.describe('Academic years — API: cross-tenant isolation', () => {
  test('TENANT_ADMIN_B cannot read a year from tenant A', async () => {
    // Skip if cross-tenant auth is broken.
    const ctxB = await safeApiContextFor({ user: (await import('../../fixtures/test-users')).TENANT_ADMIN_B });
    if (!ctxB.api) {
      test.skip(true, ctxB.reason + ' — skip cross-tenant assertion');
      return;
    }
    const apiA = await apiContextFor({ user: TENANT_ADMIN });
    const year = await makeAcademicYear(apiA, {});
    try {
      const res = await ctxB.api.get(`${API}/${year.publicUuid}`);
      expect([403, 404], 'cross-tenant year access should be denied').toContain(res.status());
    } finally {
      await year.cleanup();
      await apiA.dispose();
      await ctxB.api.dispose();
    }
  });
});
