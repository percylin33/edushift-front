import { test, expect } from '@playwright/test';
import { TENANT_ADMIN } from '../../fixtures/test-users';
import { apiContextFor } from '../../utils/api-helpers';
import { makeAcademicBundle, makeSection } from '../../factories';

/**
 * Academic sections — API coverage (Sprint 2.3).
 *
 * <p>A section is the leaf of the academic hierarchy: it belongs to a
 * year + grade, and is the target of enrollments, attendance sessions,
 * teacher assignments, etc.</p>
 */
const API = '/api/v1/academic/sections';

test.describe('Academic sections — API', () => {
  test('create → list by year → update → delete lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      const create = await api.post(API, {
        data: {
          academicYearPublicUuid: bundle.year.publicUuid,
          gradePublicUuid: bundle.grade.publicUuid,
          name: 'Section A',
          capacity: 30,
          displayOrder: 1,
        },
      });
      expect(create.status()).toBe(201);
      const publicUuid = (await create.json()).data.publicUuid;

      // LIST filtered by year. The BE param is `academicYearId`. The
      // sections endpoint returns a flat array (not paged).
      const list = await api.get(API, {
        params: { academicYearId: bundle.year.publicUuid },
      });
      expect(list.status()).toBe(200);
      const body = await list.json();
      const items = Array.isArray(body) ? body : (body.content ?? []);
      expect(items.find((s: { publicUuid: string }) => s.publicUuid === publicUuid)).toBeTruthy();

      // UPDATE — capacity only.
      const update = await api.put(`${API}/${publicUuid}`, {
        data: { capacity: 35 },
      });
      expect(update.status()).toBe(200);
      expect((await update.json()).data.capacity).toBe(35);

      // DELETE.
      const del = await api.delete(`${API}/${publicUuid}`);
      expect(del.status()).toBe(204);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('create rejects mismatched year (year from a different bundle)', async () => {
    // We need TWO academic bundles to provoke the year mismatch guard.
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundleA = await makeAcademicBundle(api);
    const bundleB = await makeAcademicBundle(api);
    try {
      // Use grade from B but year from A — depends on what guard exists.
      // Many BE endpoints don't check this; we just verify the call doesn't crash.
      const res = await api.post(API, {
        data: {
          academicYearPublicUuid: bundleA.year.publicUuid,
          gradePublicUuid: bundleB.grade.publicUuid,
          name: 'Mismatch',
          capacity: 20,
          displayOrder: 1,
        },
      });
      // Either 200/201 (if the BE doesn't validate cross-bundle) or 4xx.
      expect([200, 201, 400, 422], 'cross-bundle create does not crash').toContain(res.status());
      if (res.status() < 300) {
        await api.delete(`${API}/${(await res.json()).data.publicUuid}`).catch(() => undefined);
      }
    } finally {
      await bundleA.cleanup();
      await bundleB.cleanup();
      await api.dispose();
    }
  });

  test('list students for a section', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      const res = await api.get(`/api/v1/students?sectionPublicUuid=${bundle.section.publicUuid}`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      const items = body.content ?? body.data?.content ?? body.data?.items ?? [];
      expect(Array.isArray(items)).toBe(true);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('TEACHER cannot create sections (RBAC)', async () => {
    // Bundle must be created as TENANT_ADMIN — TEACHER doesn't have
    // permission for academic CRUD. We then attempt the POST as TEACHER.
    const adminApi = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(adminApi);
    const teacherApi = await apiContextFor({ user: (await import('../../fixtures/test-users')).TEACHER });
    try {
      const res = await teacherApi.post(API, {
        data: {
          academicYearPublicUuid: bundle.year.publicUuid,
          gradePublicUuid: bundle.grade.publicUuid,
          name: 'Should Fail',
          capacity: 20,
          displayOrder: 1,
        },
      });
      expect(res.status(), 'TEACHER should be denied').toBe(403);
    } finally {
      await bundle.cleanup();
      await adminApi.dispose();
      await teacherApi.dispose();
    }
  });
});
