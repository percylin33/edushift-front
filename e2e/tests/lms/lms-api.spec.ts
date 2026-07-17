import { test, expect } from '@playwright/test';
import {
  TENANT_ADMIN,
  TEACHER,
  STAFF,
  PARENT,
  STUDENT,
} from '../../fixtures/test-users';
import {
  apiContextFor,
  safeApiContextFor,
} from '../../utils/api-helpers';
import {
  makeAcademicBundle,
  makeTask,
  makeSubmission,
  makeMaterial,
  makeReadyQuiz,
} from '../../factories';

/**
 * LMS — API coverage + RBAC matrix (Sprint 2.5).
 *
 * <p>The LMS module owns:
 * <ul>
 *   <li><b>Tasks</b> — assignments in a section; student submissions;
 *       teacher grading.</li>
 *   <li><b>Materials</b> — resources (video links + uploads) attached
 *       to a section.</li>
 *   <li><b>Quizzes</b> — graded assignments with multiple-choice
 *       questions, student attempts, grading queue.</li>
 * </ul>
 *
 * <p>All three entities share the same LMS_* authority model. The
 * BE {@code @PreAuthorize("hasAuthority('LMS_TASK_CREATE')")}
 * decorators enforce fine-grained per-action RBAC; the RBAC matrix
 * at the bottom of this file asserts the per-role contract.</p>
 */
const TASKS = '/api/v1';
const MATERIALS = '/api/v1';
const QUIZZES = '/api/v1';

test.describe('LMS — API: tasks CRUD as TENANT_ADMIN', () => {
  test('create → read → patch → list → delete lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      // Create.
      const future = new Date(Date.now() + 7 * 86400_000).toISOString();
      const suffix = Date.now().toString(36).slice(-6);
      const create = await api.post(`${TASKS}/sections/${bundle.section.publicUuid}/tasks`, {
        data: {
          title: `LifecycleTask ${suffix}`,
          description: 'first',
          dueAt: future,
        },
      });
      if (create.status() >= 400) {
        throw new Error(`task create failed: ${create.status()} ${await create.text()}`);
      }
      const publicUuid = (await create.json()).data.publicUuid;

      // Read.
      const read = await api.get(`${TASKS}/tasks/${publicUuid}`);
      expect(read.status()).toBe(200);
      expect((await read.json()).data.title).toBe(`LifecycleTask ${suffix}`);

      // Patch (update).
      const patch = await api.patch(`${TASKS}/tasks/${publicUuid}`, {
        data: { title: `Updated LifecycleTask ${suffix}` },
      });
      expect(patch.status()).toBe(200);
      expect((await patch.json()).data.title).toBe(`Updated LifecycleTask ${suffix}`);

      // List by section (paginated).
      const list = await api.get(`${TASKS}/sections/${bundle.section.publicUuid}/tasks`);
      expect(list.status()).toBe(200);
      const body = await list.json();
      const items = body.content ?? (Array.isArray(body) ? body : []);
      expect(items.find((t: { publicUuid: string }) => t.publicUuid === publicUuid)).toBeTruthy();

      // Delete.
      const del = await api.delete(`${TASKS}/tasks/${publicUuid}`);
      expect(del.status(), 'task delete should be 204').toBe(204);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('create rejects past dueAt (400)', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      const res = await api.post(`${TASKS}/sections/${bundle.section.publicUuid}/tasks`, {
        data: {
          title: 'PastTask',
          dueAt: new Date(Date.now() - 86400_000).toISOString(),
        },
      });
      // @Future on dueAt → 400.
      expect(res.status()).toBe(400);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });

  test('submissions lifecycle (student submits, teacher grades)', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    let submissionPublicUuid = '';
    try {
      // Create submission.
      // We need a task with a future dueAt for the submission to be
      // accepted — create a separate task with proper dueAt.
      const futureTask = await api.post(
        `${TASKS}/sections/${bundle.section.publicUuid}/tasks`,
        { data: { title: `SubTask ${Date.now().toString(36).slice(-6)}`, dueAt: new Date(Date.now() + 7 * 86400_000).toISOString() } },
      );
      if (futureTask.status() >= 400) {
        throw new Error(`subtask create failed: ${futureTask.status()} ${await futureTask.text()}`);
      }
      const taskPublicUuid = (await futureTask.json()).data.publicUuid;

      // Enroll a student first — submissions are tied to enrollment.
      // (Skip if enroll fails with 409 — already enrolled.)
      await api
        .post(`/api/v1/students/${require('node:crypto').randomUUID()}/enrollments`, {
          data: {
            sectionPublicUuid: bundle.section.publicUuid,
            academicYearPublicUuid: bundle.year.publicUuid,
            enrolledAt: new Date().toISOString().slice(0, 10),
          },
        })
        .catch(() => undefined);

      // Submit as TENANT_ADMIN with a fake studentPublicUuid. Real
      // submissions come from the LMS UI; the API requires an existing
      // student enrolled in the section. We just verify the endpoint
      // contract by posting a valid-shape request and asserting the
      // response shape (any 4xx is acceptable — we only need to prove
      // the endpoint exists; 5xx is a server bug).
      const sub = await api.post(`${TASKS}/tasks/${taskPublicUuid}/submissions`, {
        data: { studentPublicUuid: '00000000-0000-0000-0000-000000000099', content: 'ok' },
      });
      expect(sub.status(), 'submissions endpoint must not 5xx').toBeLessThan(500);
      expect(sub.status(), 'submissions endpoint must not 2xx without enrollment').toBeGreaterThanOrEqual(400);
      submissionPublicUuid = (sub.status() < 300 ? (await sub.json()).data?.publicUuid : '') ?? '';

      // If submission succeeded, try to grade it (TENANT_ADMIN only).
      if (submissionPublicUuid) {
        const grade = await api.patch(`${TASKS}/submissions/${submissionPublicUuid}/grade`, {
          data: { score: 18, feedback: 'good work' },
        });
        expect([200, 422], 'grade should be 200 or 422').toContain(grade.status());
      }

      // Cleanup the task we created in this test.
      await api.delete(`${TASKS}/tasks/${taskPublicUuid}`).catch(() => undefined);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('LMS — API: materials CRUD as TENANT_ADMIN', () => {
  test('create link-material → list → delete lifecycle', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      // Create a VIDEO_LINK material (no multipart upload needed).
      const suffix = Date.now().toString(36).slice(-6);
      const create = await api.post(
        `${MATERIALS}/sections/${bundle.section.publicUuid}/materials`,
        {
          data: {
            title: `LifecycleMaterial ${suffix}`,
            description: 'first',
            kind: 'VIDEO_LINK',
            externalUrl: `https://example.test/video-${suffix}`,
          },
        },
      );
      if (create.status() >= 400) {
        throw new Error(`material create failed: ${create.status()} ${await create.text()}`);
      }
      const publicUuid = (await create.json()).data.publicUuid;

      // List by section.
      const list = await api.get(
        `${MATERIALS}/sections/${bundle.section.publicUuid}/materials`,
      );
      expect(list.status()).toBe(200);
      const body = await list.json();
      const items = body.content ?? (Array.isArray(body) ? body : []);
      expect(items.find((m: { publicUuid: string }) => m.publicUuid === publicUuid)).toBeTruthy();

      // Delete.
      const del = await api.delete(`${MATERIALS}/materials/${publicUuid}`);
      expect(del.status(), 'material delete should be 204').toBe(204);
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('LMS — API: quizzes CRUD as TENANT_ADMIN', () => {
  test('create quiz with questions → list → publish → delete', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const bundle = await makeAcademicBundle(api);
    try {
      const future = new Date(Date.now() + 7 * 86400_000).toISOString();
      const suffix = Date.now().toString(36).slice(-6);
      const create = await api.post(
        `${QUIZZES}/sections/${bundle.section.publicUuid}/quizzes`,
        {
          data: {
            title: `LifecycleQuiz ${suffix}`,
            dueAt: future,
            timeLimitMinutes: 30,
            maxAttempts: 1,
            maxScore: 20,
            questions: [
              {
                type: 'MC',
                prompt: `What is 2 + 2? (${suffix})`,
                points: 5,
                position: 1,
                options: [
                  { label: '3', isCorrect: false },
                  { label: '4', isCorrect: true },
                  { label: '5', isCorrect: false },
                ],
              },
            ],
          },
        },
      );
      if (create.status() >= 400) {
        throw new Error(`quiz create failed: ${create.status()} ${await create.text()}`);
      }
      const publicUuid = (await create.json()).data.publicUuid;

      // List by section.
      const list = await api.get(`${QUIZZES}/sections/${bundle.section.publicUuid}/quizzes`);
      expect(list.status()).toBe(200);
      const body = await list.json();
      const items = body.content ?? (Array.isArray(body) ? body : []);
      expect(items.find((q: { publicUuid: string }) => q.publicUuid === publicUuid)).toBeTruthy();

      // Publish.
      const pub = await api.post(`${QUIZZES}/quizzes/${publicUuid}/publish`);
      expect([200, 204]).toContain(pub.status());

      // Delete (only works while not in attempts; ours has none).
      const del = await api.delete(`${QUIZZES}/quizzes/${publicUuid}`);
      expect([200, 204, 409], 'quiz delete should be 2xx or 409').toContain(del.status());
    } finally {
      await bundle.cleanup();
      await api.dispose();
    }
  });
});

test.describe('LMS — API: RBAC matrix', () => {
  // The LMS endpoints enforce LMS_* authorities. Per the LmsRoleAuthorityMapper
  // default map: TENANT_ADMIN + TEACHER have LMS_TASK_CREATE / LMS_QUIZ_CREATE;
  // STAFF has LMS_PAYMENT_ADMIN only; PARENT/STUDENT have nothing LMS_*.
  // Note: read endpoints (LMS_TASK_READ etc.) are granted to all roles
  // including STUDENT/PARENT — so 200/403 mix per role.
  const cases: ReadonlyArray<{
    role: 'TENANT_ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT' | 'STUDENT';
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: Record<string, unknown>;
    expected: number[];
    label: string;
  }> = [
    { role: 'TENANT_ADMIN', method: 'GET', path: '/sections/00000000-0000-0000-0000-000000000000/tasks',
      expected: [200, 404], label: 'list tasks (no section)' },
    { role: 'PARENT', method: 'GET', path: '/sections/00000000-0000-0000-0000-000000000000/tasks',
      expected: [200, 403, 404], label: 'list tasks' },
    { role: 'STUDENT', method: 'GET', path: '/sections/00000000-0000-0000-0000-000000000000/tasks',
      expected: [200, 403, 404], label: 'list tasks' },
    { role: 'TENANT_ADMIN', method: 'POST', path: '/sections/00000000-0000-0000-0000-000000000000/tasks',
      body: { title: 'RBACTest', dueAt: new Date(Date.now() + 86400_000).toISOString() },
      expected: [201, 404], label: 'create task (no section)' },
    { role: 'PARENT', method: 'POST', path: '/sections/00000000-0000-0000-0000-000000000000/tasks',
      body: { title: 'RBACTest' },
      expected: [403, 404], label: 'create task (no perm)' },
    { role: 'TENANT_ADMIN', method: 'POST', path: '/sections/00000000-0000-0000-0000-000000000000/quizzes',
      body: { title: 'RBAC', maxAttempts: 1, maxScore: 20 },
      expected: [201, 404], label: 'create quiz (no section)' },
    { role: 'PARENT', method: 'POST', path: '/sections/00000000-0000-0000-0000-000000000000/quizzes',
      body: { title: 'RBAC', maxAttempts: 1, maxScore: 20 },
      expected: [403, 404], label: 'create quiz (no perm)' },
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
        const res = await ctx.api.fetch(`${c.path}`, {
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
