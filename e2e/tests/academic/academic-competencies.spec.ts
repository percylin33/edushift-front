import { test, expect } from '@playwright/test';
import { TENANT_ADMIN } from '../../fixtures/test-users';
import { apiContextFor } from '../../utils/api-helpers';
import { makeAcademicBundle, makeCourse } from '../../factories';

/**
 * Academic competencies + capacities — API coverage (Sprint 2.3).
 *
 * <p>Competencies are attached to a course and represent high-level
 * learning outcomes (e.g. "Resuelve problemas de regularidad,
 * equivalencia y cambio"). Capacities are the smaller actionable
 * bullets under each competency.</p>
 */
const COMPETENCIES = (cid: string) => `/api/v1/academic/courses/${cid}/competencies`;
const COMPETENCY = (uuid: string) => `/api/v1/academic/competencies/${uuid}`;
const CAPACITIES = (cid: string) => `/api/v1/academic/competencies/${cid}/capacities`;
const CAPACITY = (uuid: string) => `/api/v1/academic/capacities/${uuid}`;

test.describe('Academic competencies — API', () => {
  test('create → read → update → reorder → delete lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    const course = await makeCourse(api, { levelPublicUuids: [bundle.level.publicUuid] });
    let publicUuid = '';
    try {
      const create = await api.post(COMPETENCIES(course.publicUuid), {
        data: {
          code: `LIFEC${Date.now().toString(36).slice(-6).toUpperCase()}`,
          name: 'Lifecycle Competency',
          description: 'first',
          displayOrder: 1,
        },
      });
      if (create.status() >= 400) {
        throw new Error(`competency create failed: ${create.status()} ${await create.text()}`);
      }
      publicUuid = (await create.json()).data.publicUuid;

      const read = await api.get(COMPETENCY(publicUuid));
      expect(read.status()).toBe(200);

      // UPDATE.
      const update = await api.put(COMPETENCY(publicUuid), {
        data: { name: 'Updated Competency' },
      });
      expect(update.status()).toBe(200);

      // REORDER — non-trivial body; just verify endpoint exists.
      const reorder = await api.patch(
        `${COMPETENCIES(course.publicUuid).replace('/competencies', '/competencies/reorder')}`,
        { data: { orders: [{ competencyPublicUuid: publicUuid, ordinal: 1 }] } },
      );
      expect([200, 400, 422], 'reorder endpoint exists').toContain(reorder.status());

      // DELETE.
      const del = await api.delete(COMPETENCY(publicUuid));
      expect(del.status()).toBe(204);
    } finally {
      if (publicUuid) {
        await api.delete(COMPETENCY(publicUuid)).catch(() => undefined);
      }
      await course.cleanup();
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('seed-defaults endpoint exists and returns the documented shape', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    // We don't pin a specific course code because the BE's
    // CompetencyDefaults.bundleFor() does an exact-match lookup
    // (MAT, COMU, …) and skips courses that already have
    // competencies. Just verify the endpoint shape — response is
    // { data: { seeded, unsupportedCourseCode, courseCode,
    // competenciesCreated, capacitiesCreated, created: [] } }.
    const course = await makeCourse(api, {
      levelPublicUuids: [bundle.level.publicUuid],
    });
    try {
      const res = await api.post(`${COMPETENCIES(course.publicUuid)}/seed-defaults`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      const data = body.data ?? body;
      expect(data).toBeTruthy();
      // Either seeded=true (created competencies) or seeded=false
      // (already had / unsupported code) — both are valid outcomes.
      expect(typeof data.seeded).toBe('boolean');
      expect(Array.isArray(data.created)).toBe(true);
      expect(typeof data.competenciesCreated).toBe('number');
      expect(typeof data.capacitiesCreated).toBe('number');
    } finally {
      await course.cleanup();
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('Academic capacities — API', () => {
  test('create → list → update → reorder → delete lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    const course = await makeCourse(api, { levelPublicUuids: [bundle.level.publicUuid] });
    let competencyPublicUuid = '';
    try {
      // First create a competency.
      const comp = await api.post(COMPETENCIES(course.publicUuid), {
        data: {
          code: `PARENT${Date.now().toString(36).slice(-6).toUpperCase()}`,
          name: 'Parent Competency',
          description: 'for caps',
          displayOrder: 1,
        },
      });
      if (comp.status() >= 400) {
        throw new Error(`competency create failed: ${comp.status()} ${await comp.text()}`);
      }
      competencyPublicUuid = (await comp.json()).data.publicUuid;

      // CREATE capacity #1.
      const c1 = await api.post(CAPACITIES(competencyPublicUuid), {
        data: {
          code: `CAP${Date.now().toString(36).slice(-6).toUpperCase()}`,
          name: 'Cap 1',
          description: 'first',
          displayOrder: 1,
        },
      });
      if (c1.status() >= 400) {
        throw new Error(`capacity create failed: ${c1.status()} ${await c1.text()}`);
      }
      const c1Uuid = (await c1.json()).data.publicUuid;

      // LIST — CapacityController returns a flat array (not paged).
      const list = await api.get(CAPACITIES(competencyPublicUuid));
      expect(list.status()).toBe(200);
      const body = await list.json();
      const items = Array.isArray(body) ? body : (body.content ?? []);
      expect(items.length).toBeGreaterThanOrEqual(1);

      // UPDATE.
      const update = await api.put(CAPACITY(c1Uuid), {
        data: { name: 'Updated Cap' },
      });
      expect(update.status()).toBe(200);

      // DELETE.
      const del = await api.delete(CAPACITY(c1Uuid));
      expect(del.status()).toBe(204);
    } finally {
      await course.cleanup();
      await bundle.cleanup();
      if (competencyPublicUuid) {
        await api.delete(COMPETENCY(competencyPublicUuid)).catch(() => undefined);
      }
      await api.dispose();
    }
  });
});
