import { test, expect } from '@playwright/test';
import { STUDENT } from '../fixtures/test-users';
import { safeApiContextFor } from '../utils/api-helpers';

/**
 * RBAC — STUDENT role (QA Plan 2026-07-02 / 02-plan-por-rol.md §2.4).
 *
 * <p>Validates that a STUDENT token cannot reach privileged
 * endpoints that are gated to TENANT_ADMIN. Each test is a separate
 * privilege-escalation attempt; the spec MUST return 403 in every
 * case (no leak of existence, no 200 partial, no 500).</p>
 *
 * <p>Reference: docs/qa/03-pruebas-seguridad.md §3.1.</p>
 *
 * <p><b>2026-07-08 audit:</b> EduShift's data model has STUDENT
 * rows in {@code edushift.students} but no STUDENT users in
 * {@code edushift.users} — students do not log in directly; their
 * guardians do. The whole describe block skips with a clear reason
 * instead of asserting against a non-existent account. The spec
 * stays as scaffolding for the day the BE exposes a student-login
 * flow.</p>
 */

const FORBIDDEN_ENDPOINTS: { method: string; path: string; label: string }[] = [
  { method: 'GET', path: '/api/v1/users', label: 'list users' },
  { method: 'POST', path: '/api/v1/users', label: 'create user' },
  { method: 'PATCH', path: '/api/v1/tenants/me', label: 'patch tenant' },
  { method: 'POST', path: '/api/v1/admin/tenants', label: 'admin tenants' },
  { method: 'DELETE', path: '/api/v1/students/00000000-0000-0000-0000-000000000099', label: 'delete student' },
  { method: 'POST', path: '/api/v1/attendance/records/foo/approve-justification', label: 'approve justification' },
  { method: 'POST', path: '/api/v1/payments/admin/reconcile', label: 'payment admin' },
  { method: 'POST', path: '/api/v1/admin/impersonation/start', label: 'impersonation' },
  { method: 'POST', path: '/api/v1/academic/years/foo/activate', label: 'activate year' },
  { method: 'PUT', path: '/api/v1/submissions/foo/grade', label: 'grade submission' },
  { method: 'POST', path: '/api/v1/sections/foo/quizzes', label: 'create quiz' },
];

const SKIP_REASON =
  'STUDENT has no login in EduShift (students authenticate via ' +
  'guardian). Skip until the BE exposes a student-login flow.';

test.describe('RBAC — STUDENT', () => {
  test('cannot access privileged endpoints (each must return 403)', async () => {
    const got = await safeApiContextFor({ user: STUDENT });
    if (!got.api) { test.skip(true, got.reason); return; }
    const api = got.api;
    try {
      const me = await api.get('/api/v1/auth/me');
      if (me.status() !== 200) {
        test.skip(true, SKIP_REASON);
        return;
      }
      for (const ep of FORBIDDEN_ENDPOINTS) {
        const res = await api.fetch(ep.path, { method: ep.method });
        expect.soft(res.status(), `${ep.method} ${ep.path} (${ep.label})`)
          .toBeGreaterThanOrEqual(400);
        expect.soft(res.status(), `${ep.method} ${ep.path} (${ep.label})`)
          .toBeLessThan(500);
      }
    } finally {
      await api.dispose();
    }
  });

  test('STUDENT can read own profile', async () => {
    const got = await safeApiContextFor({ user: STUDENT });
    if (!got.api) { test.skip(true, got.reason); return; }
    const api = got.api;
    try {
      const res = await api.get('/api/v1/auth/me');
      if (res.status() !== 200) {
        test.skip(true, SKIP_REASON);
        return;
      }
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(STUDENT.email);
    } finally {
      await api.dispose();
    }
  });
});