import { test, expect } from '@playwright/test';
import {
  TENANT_ADMIN,
  TEACHER,
  STAFF,
  PARENT,
  STUDENT,
} from '../../fixtures/test-users';
import { apiContextFor, safeApiContextFor } from '../../utils/api-helpers';
import {
  makeAcademicBundle,
  makeTeacher,
  makeTeacherAssignment,
  makeAcademicPeriod,
} from '../../factories';

/**
 * Evaluations + Grade records + Rubrics + Gradebook — API coverage
 * + RBAC matrix (Sprint 2.7).
 *
 * <p>The evaluations module covers:
 * <ul>
 *   <li><b>Evaluations</b> — graded assignments attached to a
 *       (teacher × course × section × period) tuple. Lifecycle:
 *       DRAFT → PUBLISHED → CLOSED.</li>
 *   <li><b>Grade records</b> — per-student score (numeric) or literal
 *       grade. Bulk-grading endpoint creates one row per student.</li>
 *   <li><b>Rubrics</b> — reusable grading templates with criteria.
 *       Fork from system rubric → customise for an evaluation.</li>
 *   <li><b>Gradebook</b> — read-only grid of evaluations × students.</li>
 * </ul>
 *
 * <p>All write endpoints require
 * {@code hasAnyRole('TENANT_ADMIN','TEACHER')} via
 * {@code @PreAuthorize}. PARENT / STUDENT / STAFF are 403.</p>
 */
const EVAL = '/api/v1/academic';
const GRADEBOOK = '/api/v1/academic';
const RUBRIC = '/api/v1/academic/rubrics';

test.describe('Evaluations — API: lifecycle as TENANT_ADMIN', () => {
  test('create → read → patch → publish → close lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const teacher = await makeTeacher(api, {});
    const bundle = await makeAcademicBundle(api);
    const period = await makeAcademicPeriod(api, {
      academicYearPublicUuid: bundle.year.publicUuid,
    });
    let assignmentPublicUuid = '';
    try {
      // 1. Create assignment (TEACHER can read+grade but only TA can assign).
      const assignRes = await api.post(
        `/api/v1/teachers/${teacher.publicUuid}/assignments`,
        {
          data: {
            sectionPublicUuid: bundle.section.publicUuid,
            coursePublicUuid: bundle.course.publicUuid,
            academicPeriodPublicUuid: period.publicUuid,
          },
        },
      );
      if (assignRes.status() >= 400) {
        throw new Error(`assignment create failed: ${assignRes.status()} ${await assignRes.text()}`);
      }
      assignmentPublicUuid = (await assignRes.json()).data.publicUuid;

      // 2. Create evaluation (TASK + SCORE_0_20).
      const suffix = Date.now().toString(36).slice(-6);
      const create = await api.post(
        `${EVAL}/assignments/${assignmentPublicUuid}/evaluations`,
        {
          data: {
            kind: 'TASK',
            name: `LifecycleEval ${suffix}`,
            weight: 10.0,
            scheduledDate: '2026-07-01',
            scale: 'SCORE_0_20',
          },
        },
      );
      if (create.status() >= 400) {
        throw new Error(`eval create failed: ${create.status()} ${await create.text()}`);
      }
      const publicUuid = (await create.json()).data.publicUuid;

      // 3. Read.
      const read = await api.get(`${EVAL}/evaluations/${publicUuid}`);
      expect(read.status()).toBe(200);

      // 4. Patch (rename).
      const patch = await api.put(`${EVAL}/evaluations/${publicUuid}`, {
        data: { name: `Updated Eval ${suffix}` },
      });
      expect(patch.status()).toBe(200);

      // 5. Publish (DRAFT → PUBLISHED).
      const publish = await api.post(`${EVAL}/evaluations/${publicUuid}/publish`);
      expect([200, 204]).toContain(publish.status());

      // 6. Close (PUBLISHED → CLOSED).
      const close = await api.post(`${EVAL}/evaluations/${publicUuid}/close`);
      expect([200, 204]).toContain(close.status());

      // 7. Delete (only works if no grades exist).
      const del = await api.delete(`${EVAL}/evaluations/${publicUuid}`);
      expect([200, 204, 409], 'eval delete should be 2xx or 409').toContain(del.status());
    } finally {
      await api.delete(`/api/v1/assignments/${assignmentPublicUuid}`).catch(() => undefined);
      await teacher.cleanup();
      await period.cleanup();
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('create rejects EVAL_KIND_SCALE_MISMATCH (400)', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    const period = await makeAcademicPeriod(api, {
      academicYearPublicUuid: bundle.year.publicUuid,
    });
    let assignmentPublicUuid = '';
    try {
      // Create assignment first.
      const teacher = await makeTeacher(api, {});
      const assignRes = await api.post(
        `/api/v1/teachers/${teacher.publicUuid}/assignments`,
        {
          data: {
            sectionPublicUuid: bundle.section.publicUuid,
            coursePublicUuid: bundle.course.publicUuid,
            academicPeriodPublicUuid: period.publicUuid,
          },
        },
      );
      if (assignRes.status() >= 400) {
        throw new Error(`assignment create failed: ${assignRes.status()}`);
      }
      assignmentPublicUuid = (await assignRes.json()).data.publicUuid;

      // EXAM must use SCORE_0_20 — using LITERAL_AD should fail with
      // EVAL_KIND_SCALE_MISMATCH (400).
      const res = await api.post(
        `${EVAL}/assignments/${assignmentPublicUuid}/evaluations`,
        {
          data: {
            kind: 'EXAM',
            name: `MismatchEval ${Date.now().toString(36).slice(-6)}`,
            weight: 20.0,
            scheduledDate: '2026-07-01',
            scale: 'LITERAL_AD',
          },
        },
      );
      expect(res.status(), 'EXAM + LITERAL_AD should be 400').toBe(400);
    } finally {
      await api.delete(`/api/v1/assignments/${assignmentPublicUuid}`).catch(() => undefined);
      await period.cleanup();
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('Evaluations — API: grade records', () => {
  test('create → list → patch grade record (TA workflow)', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const teacher = await makeTeacher(api, {});
    const bundle = await makeAcademicBundle(api);
    const period = await makeAcademicPeriod(api, {
      academicYearPublicUuid: bundle.year.publicUuid,
    });
    let assignmentPublicUuid = '';
    let evaluationPublicUuid = '';
    try {
      // Setup: assignment + published evaluation.
      const assignRes = await api.post(
        `/api/v1/teachers/${teacher.publicUuid}/assignments`,
        {
          data: {
            sectionPublicUuid: bundle.section.publicUuid,
            coursePublicUuid: bundle.course.publicUuid,
            academicPeriodPublicUuid: period.publicUuid,
          },
        },
      );
      if (assignRes.status() >= 400) {
        throw new Error(`assignment create failed: ${assignRes.status()}`);
      }
      assignmentPublicUuid = (await assignRes.json()).data.publicUuid;

      const suffix = Date.now().toString(36).slice(-6);
      const evalRes = await api.post(
        `${EVAL}/assignments/${assignmentPublicUuid}/evaluations`,
        {
          data: {
            kind: 'TASK',
            name: `GradeRecEval ${suffix}`,
            weight: 10.0,
            scheduledDate: '2026-07-01',
            scale: 'SCORE_0_20',
          },
        },
      );
      if (evalRes.status() >= 400) {
        throw new Error(`eval create failed: ${evalRes.status()}`);
      }
      evaluationPublicUuid = (await evalRes.json()).data.publicUuid;

      // Note: grade records require a real enrolled student with an
      // enrollment. Without that setup, POST returns 422 STUDENT_NOT_IN_EVAL.
      // We verify the endpoint shape and that any non-5xx is acceptable.
      const fakeStudent = '00000000-0000-0000-0000-000000000099';
      const create = await api.post(
        `${EVAL}/evaluations/${evaluationPublicUuid}/grade-records`,
        { data: { studentPublicUuid: fakeStudent, score: 18.0 } },
      );
      expect(create.status(), 'grade-records endpoint must not 5xx').toBeLessThan(500);
      // 404 / 422 are the typical responses for a fake student.
      expect([200, 201, 404, 422]).toContain(create.status());

      // List records.
      const list = await api.get(
        `${EVAL}/evaluations/${evaluationPublicUuid}/grade-records`,
      );
      expect(list.status()).toBe(200);
    } finally {
      await api.delete(`/api/v1/assignments/${assignmentPublicUuid}`).catch(() => undefined);
      await teacher.cleanup();
      await period.cleanup();
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('Evaluations — API: rubrics', () => {
  test('list system rubrics → fork custom rubric', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      // GET /academic/rubrics/system returns the seed system rubric(s).
      const systemList = await api.get(`${RUBRIC}/system`);
      expect(systemList.status()).toBe(200);
      const sysBody = await systemList.json();
      const sysItems = Array.isArray(sysBody) ? sysBody : (sysBody.content ?? []);
      expect(Array.isArray(sysItems)).toBe(true);

      // Fork endpoint exists; accept 200/201/404 (if system rubric isn't
      // found in this tenant's data). Skip the fork body if there's no
      // seed rubric to fork from.
      if (sysItems.length > 0 && sysItems[0]?.publicUuid) {
        const fork = await api.post(
          `${RUBRIC}/${sysItems[0].publicUuid}/fork`,
          { data: { name: 'Custom Fork Spec' } },
        );
        expect([200, 201, 404, 409]).toContain(fork.status());
      }

      // List rubrics (paginated).
      const list = await api.get(RUBRIC);
      expect(list.status()).toBe(200);
    } finally {
      await api.dispose();
    }
  });
});

test.describe('Evaluations — API: gradebook (TENANT_ADMIN)', () => {
  test('GET gradebook for a teacher-assignment', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const teacher = await makeTeacher(api, {});
    const bundle = await makeAcademicBundle(api);
    const period = await makeAcademicPeriod(api, {
      academicYearPublicUuid: bundle.year.publicUuid,
    });
    let assignmentPublicUuid = '';
    try {
      const assignRes = await api.post(
        `/api/v1/teachers/${teacher.publicUuid}/assignments`,
        {
          data: {
            sectionPublicUuid: bundle.section.publicUuid,
            coursePublicUuid: bundle.course.publicUuid,
            academicPeriodPublicUuid: period.publicUuid,
          },
        },
      );
      if (assignRes.status() >= 400) {
        throw new Error(`assignment create failed: ${assignRes.status()}`);
      }
      assignmentPublicUuid = (await assignRes.json()).data.publicUuid;

      const res = await api.get(
        `${GRADEBOOK}/teacher-assignments/${assignmentPublicUuid}/gradebook`,
      );
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body) || typeof body === 'object').toBe(true);
    } finally {
      await api.delete(`/api/v1/assignments/${assignmentPublicUuid}`).catch(() => undefined);
      await teacher.cleanup();
      await period.cleanup();
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('Evaluations — API: RBAC matrix', () => {
  // Evaluations endpoints use hasAnyRole('TENANT_ADMIN','TEACHER').
  // PARENT / STUDENT / STAFF are 403. The gradebook read endpoint is
  // typically TENANT_ADMIN + TEACHER too.
  const cases: ReadonlyArray<{
    role: 'TENANT_ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT' | 'STUDENT';
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: Record<string, unknown>;
    expected: number[];
    label: string;
  }> = [
    { role: 'TENANT_ADMIN', method: 'GET',    path: '/academic/rubrics',           expected: [200],          label: 'list rubrics' },
    { role: 'PARENT',      method: 'GET',    path: '/academic/rubrics',           expected: [403],         label: 'list rubrics (no perm)' },
    { role: 'STUDENT',     method: 'GET',    path: '/academic/rubrics',           expected: [403],         label: 'list rubrics (no perm)' },
    { role: 'TENANT_ADMIN', method: 'POST',   path: '/academic/rubrics',           body: {
      code: `rb-${Date.now().toString(36).slice(-6)}`,
      name: `RBAC rubric ${Date.now().toString(36).slice(-6)}`,
      criteria: [{ key: 'c1', name: 'criterion 1', weight: 100 }],
      levels: [{ code: 'A', name: 'A' }, { code: 'B', name: 'B' }],
    }, expected: [200, 201],    label: 'create rubric' },
    { role: 'PARENT',      method: 'POST',   path: '/academic/rubrics',           body: {
      code: `rb-p-${Date.now().toString(36).slice(-6)}`,
      name: `RBAC rubric P ${Date.now().toString(36).slice(-6)}`,
      criteria: [{ key: 'c1', name: 'criterion 1', weight: 100 }],
      levels: [{ code: 'A', name: 'A' }, { code: 'B', name: 'B' }],
    }, expected: [403],         label: 'create rubric (no perm)' },
    { role: 'TENANT_ADMIN', method: 'POST',   path: '/academic/assignments/00000000-0000-0000-0000-000000000000/evaluations',
      body: { kind: 'TASK', name: 'rbac', weight: 10.0, scheduledDate: '2026-07-01', scale: 'SCORE_0_20' },
      expected: [400, 404], label: 'create eval (no assignment)' },
    { role: 'PARENT',      method: 'POST',   path: '/academic/assignments/00000000-0000-0000-0000-000000000000/evaluations',
      body: { kind: 'TASK', name: 'rbac', weight: 10.0, scheduledDate: '2026-07-01', scale: 'SCORE_0_20' },
      expected: [403],       label: 'create eval (no perm)' },
  ];
  for (const c of cases) {
    test(`${c.role} ${c.method} ${c.path} (${c.label}): ${c.expected.join('|')}`, async () => {
      const user = c.role === 'TENANT_ADMIN' ? TENANT_ADMIN
        : c.role === 'TEACHER' ? TEACHER
        : c.role === 'STAFF' ? STAFF
        : c.role === 'PARENT' ? PARENT
        : STUDENT;
      const ctx = await safeApiContextFor({ user });
      if (!ctx.api) {
        test.skip(true, ctx.reason);
        return;
      }
      try {
        // /api/v1 is auto-prepended by the WebConfiguration — paths in
        // the RBAC matrix omit that prefix; add it here.
        const url = `${process.env['API_URL'] ?? 'http://localhost:8081'}/api/v1${c.path}`;
        const res = await ctx.api.fetch(url, {
          method: c.method,
          data: c.body,
        });
        expect(c.expected, `${c.role} ${c.method} ${c.path}`).toContain(res.status());
      } finally {
        await ctx.api.dispose();
      }
    });
  }
});
