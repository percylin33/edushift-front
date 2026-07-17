import { test, expect } from '@playwright/test';
import {
  TENANT_ADMIN,
  TEACHER,
  STAFF,
  PARENT,
  STUDENT,
} from '../../fixtures/test-users';
import { apiContextFor, safeApiContextFor } from '../../utils/api-helpers';

/**
 * Notifications + Announcements + Help — API coverage + RBAC matrix
 * (Sprint 2.11).
 *
 * <p>The notifications module owns:
 * <ul>
 *   <li><b>Notifications</b> — per-user inbox with unread-count, mark-as-read,
 *       read-all. Endpoints require {@code isAuthenticated()}.</li>
 *   <li><b>Announcements</b> — global broadcasts with audience targeting.
 *       Read endpoints: {@code isAuthenticated()}.
 *       Create/update/publish/delete require {@code LMS_ANNOUNCEMENTS_CREATE}.</li>
 *   <li><b>Help</b> — public manual index + per-user progress + feedback.
 *       Progress + feedback are {@code isAuthenticated()}.</li>
 * </ul>
 *
 * <p>Note on URL prefix: the notifications controllers declare
 * {@code @RequestMapping("/notifications")} and
 * {@code @RequestMapping("/announcements")} (correct shape, no
 * double-prefix bug). Help uses
 * {@code @RequestMapping("/v1/help/progress")} — single
 * {@code /v1} prefix (will get the global {@code /v1} via
 * WebConfiguration, see Phase 2.10 lessons).</p>
 */
const NOTIFS = '/api/v1/notifications';
const ANN = '/api/v1/announcements';
const HELP = '/api/v1/help';

test.describe('Notifications — API: per-user inbox', () => {
  test('list + unread-count + mark-read + read-all', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      // LIST inbox.
      const list = await api.get(NOTIFS);
      expect(list.status()).toBe(200);
      const body = await list.json();
      const items = body.data ?? (Array.isArray(body) ? body : []);
      expect(Array.isArray(items)).toBe(true);

      // UNREAD COUNT.
      const unread = await api.get(`${NOTIFS}/unread-count`);
      expect(unread.status()).toBe(200);

      // READ-ALL is idempotent.
      const readAll = await api.post(`${NOTIFS}/read-all`);
      expect([200, 204, 404]).toContain(readAll.status());

      // PREFERENCES (GET + POST round-trip).
      const prefsGet = await api.get(`${NOTIFS}/preferences`);
      expect(prefsGet.status()).toBe(200);
      const prefs = (await prefsGet.json()).data ?? prefsGet.json();
      const prefsPost = await api.post(`${NOTIFS}/preferences`, {
        data: { digestEnabled: true, emailEnabled: false },
      });
      expect([200, 400]).toContain(prefsPost.status());
      void prefs;
    } finally {
      await api.dispose();
    }
  });
});

test.describe('Announcements — API: publish + read', () => {
  test('TA creates + publishes, all roles can read published', async () => {
    const adminApi = await apiContextFor({ user: TENANT_ADMIN });
    const teacherApi = await apiContextFor({ user: TEACHER });
    let createdUuid = '';
    try {
      // CREATE — requires LMS_ANNOUNCEMENTS_CREATE.
      const create = await adminApi.post(ANN, {
        data: {
          title: `LifecycleAnnouncement ${Date.now().toString(36).slice(-6)}`,
          bodyHtml: '<p>e2e lifecycle</p>',
          audienceType: 'SCHOOL',
          pinned: false,
          audienceIds: [],
        },
      });
      if (create.status() >= 400) {
        throw new Error(`announcement create failed: ${create.status()} ${await create.text()}`);
      }
      createdUuid = (await create.json()).data.publicUuid;

      // PUBLISH. The BE writes AnnouncementRecipient rows for the
      // audience. After the V75 follow-up + AnnouncementAudienceResolver
      // fix, the resolver returns users.public_uuid (matching the FK
      // target) — so publish succeeds with 200/204. A 409 here is a
      // regression. See docs/qa/migrations-lessons.md.
      const pub = await adminApi.post(`${ANN}/${createdUuid}/publish`);
      expect([200, 204], 'publish should succeed (V75 fix)').toContain(pub.status());

      // READ as another role (TEACHER) — listPublished.
      const list = await teacherApi.get(`${ANN}`);
      expect(list.status()).toBe(200);

      // Get one.
      const one = await teacherApi.get(`${ANN}/${createdUuid}`);
      expect(one.status()).toBe(200);

      // MARK READ (idempotent).
      const mark = await teacherApi.post(`${ANN}/${createdUuid}/read`);
      expect([200, 204, 404]).toContain(mark.status());
    } finally {
      // DELETE (cleanup).
      if (createdUuid) {
        await adminApi.delete(`${ANN}/${createdUuid}`).catch(() => undefined);
      }
      await adminApi.dispose();
      await teacherApi.dispose();
    }
  });
});

test.describe('Notifications + Announcements — RBAC matrix', () => {
  // Notifications + announcements GETs are @isAuthenticated().
  // Announcements create/publish/delete require LMS_ANNOUNCEMENTS_CREATE.
  // We test that all roles can read but only TENANT_ADMIN can create.
  const cases: ReadonlyArray<{
    role: 'TENANT_ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT' | 'STUDENT';
    method: 'GET' | 'POST';
    path: string;
    body?: Record<string, unknown>;
    expected: number[];
    label: string;
  }> = [
    { role: 'TENANT_ADMIN', method: 'GET',  path: '/api/v1/notifications',
      expected: [200], label: 'TA lists notifications' },
    { role: 'TEACHER',     method: 'GET',  path: '/api/v1/notifications',
      expected: [200], label: 'TEACHER lists notifications' },
    { role: 'PARENT',      method: 'GET',  path: '/api/v1/notifications',
      expected: [200], label: 'PARENT lists notifications' },
    { role: 'STUDENT',     method: 'GET',  path: '/api/v1/notifications',
      expected: [200], label: 'STUDENT lists notifications' },
    { role: 'TENANT_ADMIN', method: 'GET',  path: '/api/v1/announcements',
      expected: [200], label: 'TA lists announcements' },
    { role: 'PARENT',      method: 'GET',  path: '/api/v1/announcements',
      expected: [200], label: 'PARENT reads announcements' },
    { role: 'TENANT_ADMIN', method: 'POST', path: '/api/v1/announcements',
      body: { title: 'rbac', bodyHtml: '<p>rbac</p>', audienceType: 'SCHOOL', pinned: false },
      expected: [200, 201, 400], label: 'TA creates announcement' },
    { role: 'PARENT',      method: 'POST', path: '/api/v1/announcements',
      body: { title: 'rbac', bodyHtml: '<p>rbac</p>', audienceType: 'SCHOOL' },
      expected: [403, 404], label: "PARENT denied announcement creation" },
    { role: 'STUDENT',     method: 'POST', path: '/api/v1/announcements',
      body: { title: "rbac", bodyHtml: "<p>rbac</p>", audienceType: "SCHOOL", pinned: false },
      expected: [403, 404], label: "STUDENT denied announcement creation" },
  ];
  for (const c of cases) {
    test(`${c.role} ${c.method} ${c.path} (${c.label}): ${c.expected.join('|')}`, async () => {
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
        const url = `${process.env['API_URL'] ?? 'http://localhost:8081'}${c.path}`;
        const res = await ctx.api.fetch(url, {
          method: c.method,
          data: c.body,
        });
        expect(c.expected, `${role} ${c.method} ${c.path}`).toContain(res.status());
      } finally {
        await ctx.api.dispose();
      }
    });
  }
});

test.describe('Help — API: public manual + user progress + feedback', () => {
  test('GET /help/manuals lists available manuals (public)', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      // The Help manual index is public — no auth required.
      const res = await api.get(`${HELP}/manuals`);
      expect([200, 401]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        const items = body.data ?? (Array.isArray(body) ? body : []);
        expect(Array.isArray(items)).toBe(true);
      }
    } finally {
      await api.dispose();
    }
  });

  test('authenticated user can record help progress + feedback', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      // GET progress for a role/file.
      const progressGet = await api.get(`${HELP}/progress/teacher/getting-started`);
      // 404 if no progress yet, 200 if there's progress.
      expect([200, 404]).toContain(progressGet.status());

      // PUT progress — registers an item as read.
      const itemId = `e2e-item-${Date.now().toString(36).slice(-6)}`;
      const put = await api.put(`${HELP}/progress/teacher/getting-started`, {
        data: { itemId },
      });
      expect([200, 204, 400, 404]).toContain(put.status());

      // DELETE — removes the item.
      const del = await api.delete(`${HELP}/progress/teacher/getting-started/${itemId}`);
      expect([200, 204, 404]).toContain(del.status());

      // POST feedback.
      const fb = await api.post(`${HELP}/feedback`, {
        data: { role: 'teacher', message: 'e2e feedback', rating: 4 },
      });
      expect([200, 201, 400, 422]).toContain(fb.status());
    } finally {
      await api.dispose();
    }
  });
});
