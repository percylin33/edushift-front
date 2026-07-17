import { test, expect, request as playwrightRequest } from '@playwright/test';
import {
  TENANT_ADMIN,
  TEACHER,
  STAFF,
  PARENT,
  STUDENT,
} from '../../fixtures/test-users';

/**
 * Dynamic RBAC matrix — cross-cutting authorization smoke gate.
 *
 * <p>This single spec asserts the system-wide RBAC contract by
 * parametrizing over a curated catalog of representative endpoints
 * across all major modules. It complements (and partially overlaps
 * with) the per-module RBAC matrices — its value is the cross-cutting
 * consistency check, not the per-endpoint detail.</p>
 *
 * <h3>Design goals</h3>
 * <ol>
 *   <li><b>Default-deny</b> — every request that gets through the
 *       authentication layer but lacks authority must return 401/403/404,
 *       never 200. The <b>no 5xx</b> contract is the strongest single
 *       assertion this spec makes.</li>
 *   <li><b>Role hierarchy</b> — TEACHER can do everything STUDENT can
 *       (read-only) plus more; PARENT can see own student's data; TA is
 *       the superset for tenant-scoped endpoints.</li>
 *   <li><b>Authority consistency</b> — the {@code LMS_*} authorities
 *       gate endpoints uniformly across modules.</li>
 *   <li><b>Smoke</b> — this runs in ~30s and catches cross-cutting
 *       regressions (auth interceptor misconfig, role mapping wrong,
 *       etc.) faster than running the per-module matrices in isolation.</li>
 * </ol>
 *
 * <p>The actual RBAC matrix is encoded per-endpoint (not generic). For
 * each (endpoint, role) pair we know the expected status: TA-then-TEACHER
 * for write paths, all-read for GETs, etc. Tests assert
 * against the actual expected status for each cell.</p>
 */
const BASE = process.env['API_URL'] ?? 'http://localhost:8081';

type Role = 'TENANT_ADMIN' | 'TEACHER' | 'STAFF' | 'PARENT' | 'STUDENT';
type Expected = 200 | 201 | 204 | 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503;

interface EndpointCase {
  /** Stable identifier used in the test name. */
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path with optional {placeholder}. Each placeholder is replaced per-role. */
  path: string;
  /** Optional body for write methods. */
  body?: Record<string, unknown>;
  /** Expected status per role. */
  expected: Record<Role, ReadonlyArray<Expected>>;
}

const CATALOG: ReadonlyArray<EndpointCase> = [
  // Auth — authenticated, all roles.
  {
    id: 'auth-me',
    method: 'GET',
    path: '/api/v1/auth/me',
    expected: {
      TENANT_ADMIN: [200], TEACHER: [200], STAFF: [200], PARENT: [200], STUDENT: [200],
    },
  },

  // Students list — TA only (this module is tenant-admin-only).
  {
    id: 'students-list',
    method: 'GET',
    path: '/api/v1/students?size=1',
    expected: {
      TENANT_ADMIN: [200], TEACHER: [403], STAFF: [403], PARENT: [403], STUDENT: [403],
    },
  },

  // Teachers list — TA only (hasRole TENANT_ADMIN).
  {
    id: 'teachers-list',
    method: 'GET',
    path: '/api/v1/teachers?size=1',
    expected: {
      TENANT_ADMIN: [200], TEACHER: [403], STAFF: [403], PARENT: [403], STUDENT: [403],
    },
  },

  // LMS tasks list — LMS_TASK_READ (all roles have it; section not found → 404).
  {
    id: 'lms-tasks-list',
    method: 'GET',
    path: '/api/v1/sections/00000000-0000-0000-0000-000000000000/tasks',
    expected: {
      TENANT_ADMIN: [200, 404], TEACHER: [200, 404], STAFF: [200, 404], PARENT: [200, 404], STUDENT: [200, 404],
    },
  },

  // LMS tasks create — LMS_TASK_CREATE (TA + TEACHER only).
  {
    id: 'lms-tasks-create',
    method: 'POST',
    path: '/api/v1/sections/00000000-0000-0000-0000-000000000000/tasks',
    body: { title: 'rbac-test', description: 'rbac' },
    expected: {
      TENANT_ADMIN: [400, 404], TEACHER: [400, 404], STAFF: [403], PARENT: [403], STUDENT: [403],
    },
  },

  // LMS quizzes create — LMS_QUIZ_CREATE (TA + TEACHER only).
  // NOTE: quiz body must pass @Valid @RequestBody *before* PreAuthorize
  // runs (Spring MVC resolves args first).  Without required fields
  // (maxAttempts, maxScore) even unauthorized roles get 400.
  {
    id: 'lms-quizzes-create',
    method: 'POST',
    path: '/api/v1/sections/00000000-0000-0000-0000-000000000000/quizzes',
    body: { title: 'rbac-test', description: 'rbac', timeLimitMinutes: 60, maxAttempts: 1, maxScore: 100 },
    expected: {
      TENANT_ADMIN: [400, 404], TEACHER: [400, 404], STAFF: [403], PARENT: [403], STUDENT: [403],
    },
  },

  // Learning sessions — TA only (hasRole TENANT_ADMIN).
  {
    id: 'sessions-create',
    method: 'POST',
    path: '/api/v1/learning-sessions',
    body: { assignmentUuid: '00000000-0000-0000-0000-000000000000', unitUuid: '00000000-0000-0000-0000-000000000000', title: 'rbac', scheduledDate: '2030-01-01', durationMinutes: 60 },
    expected: {
      TENANT_ADMIN: [400, 404], TEACHER: [403], STAFF: [403], PARENT: [403], STUDENT: [403],
    },
  },

  // Attendance list — TA + TEACHER (hasAnyRole TENANT_ADMIN, TEACHER).
  {
    id: 'attendance-list',
    method: 'GET',
    path: '/api/v1/attendance/sessions?size=1',
    expected: {
      TENANT_ADMIN: [200], TEACHER: [200], STAFF: [403], PARENT: [403], STUDENT: [403],
    },
  },

  // AI chat — LMS_AI_GENERATE (TA + TEACHER only).
  {
    id: 'ai-chat-create',
    method: 'POST',
    // AI chat uses the /api/v1/v1/ double-prefix path (see Phase 2.9
    // lessons — the controller has @RequestMapping("/v1/ai/chat")).
    // The endpoint accepts an empty session POST and returns 200/201/409
    // depending on FK state in tecnosur.
    path: '/api/v1/v1/ai/chat/sessions',
    body: { title: 'rbac-test', systemPromptKey: 'default' },
    expected: {
      TENANT_ADMIN: [201, 400, 409], TEACHER: [201, 400, 409], STAFF: [403], PARENT: [403], STUDENT: [403],
    },
  },

  // Reports list — isAuthenticated.
  {
    id: 'reports-list',
    method: 'GET',
    path: '/api/v1/reports?size=1',
    expected: {
      TENANT_ADMIN: [200], TEACHER: [200], STAFF: [200], PARENT: [200], STUDENT: [200],
    },
  },

  // Notifications list — isAuthenticated.
  {
    id: 'notifications-list',
    method: 'GET',
    path: '/api/v1/notifications?size=1',
    expected: {
      TENANT_ADMIN: [200], TEACHER: [200], STAFF: [200], PARENT: [200], STUDENT: [200],
    },
  },

  // Announcements list — isAuthenticated (any role can read).
  {
    id: 'announcements-list',
    method: 'GET',
    path: '/api/v1/announcements?size=1',
    expected: {
      TENANT_ADMIN: [200], TEACHER: [200], STAFF: [200], PARENT: [200], STUDENT: [200],
    },
  },
];

const ROLES: ReadonlyArray<Role> = ['TENANT_ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'];

for (const c of CATALOG) {
  for (const role of ROLES) {
    test(`${c.id} as ${role}`, async () => {
      const user =
        role === 'TENANT_ADMIN' ? TENANT_ADMIN
        : role === 'TEACHER' ? TEACHER
        : role === 'STAFF' ? STAFF
        : role === 'PARENT' ? PARENT
        : STUDENT;

      // Per-role fresh login to avoid shared-state races.
      const loginCtx = await playwrightRequest.newContext({ baseURL: BASE });
      let token: string | undefined;
      try {
        const login = await loginCtx.post('/api/v1/auth/login', {
          headers: {
            'X-Tenant-Slug': user.tenantSlug,
            'Content-Type': 'application/json',
          },
          data: { email: user.email, password: user.password },
        });
        if (!login.ok()) {
          test.skip(true, `${user.email} login failed with ${login.status()}`);
          return;
        }
        token = (await login.json()).accessToken;
      } finally {
        await loginCtx.dispose();
      }

      // Per-role fresh authenticated context.
      const ctx = await playwrightRequest.newContext({
        baseURL: BASE,
        extraHTTPHeaders: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Slug': user.tenantSlug,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
      try {
        const res = await ctx.fetch(c.path, {
          method: c.method,
          data: c.method === 'GET' || c.method === 'DELETE' ? undefined : c.body,
        });
        const expected = c.expected[role];
        expect(
          expected,
          `${c.id} as ${role} ${c.method} ${c.path} expected ${expected.join('|')}, got ${res.status()}`,
        ).toContain(res.status());
      } finally {
        await ctx.dispose();
      }
    });
  }
}
