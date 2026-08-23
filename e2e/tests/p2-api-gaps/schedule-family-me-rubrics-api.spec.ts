import { test, expect } from '@playwright/test';
import {
  PARENT,
  STUDENT,
  TEACHER,
  TENANT_ADMIN,
} from '../../fixtures/test-users';
import { safeApiContextFor } from '../../utils/api-helpers';

/**
 * P2 API gaps — minimal happy-path + RBAC for modules that had no
 * dedicated Playwright API suite (schedule / family / me / rubrics).
 *
 * <p>Tag: {@code @api}. These are contract canaries, not full CRUD.</p>
 */
test.describe('P2 API gaps @api', () => {
  test('FAMILY — PARENT lists children (200); STUDENT forbidden (4xx)', async () => {
    const parentCtx = await safeApiContextFor({ user: PARENT });
    if (!parentCtx.api) {
      test.skip(true, parentCtx.reason);
      return;
    }
    const studentCtx = await safeApiContextFor({ user: STUDENT });
    if (!studentCtx.api) {
      await parentCtx.api.dispose();
      test.skip(true, studentCtx.reason);
      return;
    }
    try {
      const ok = await parentCtx.api.get('/api/v1/family/children');
      // 200 with list (possibly empty). Some seeds return 404 when the
      // guardian has no linked children — still a valid contract response.
      expect([200, 404], `PARENT /family/children got ${ok.status()}`).toContain(ok.status());
      expect(ok.status()).toBeLessThan(500);

      const denied = await studentCtx.api.get('/api/v1/family/children');
      expect(denied.status(), 'STUDENT /family/children').toBeGreaterThanOrEqual(400);
      expect(denied.status()).toBeLessThan(500);
    } finally {
      await parentCtx.api.dispose();
      await studentCtx.api.dispose();
    }
  });

  test('ME — STUDENT reads profile (200); TEACHER forbidden (4xx)', async () => {
    const studentCtx = await safeApiContextFor({ user: STUDENT });
    if (!studentCtx.api) {
      test.skip(true, studentCtx.reason);
      return;
    }
    const teacherCtx = await safeApiContextFor({ user: TEACHER });
    if (!teacherCtx.api) {
      await studentCtx.api.dispose();
      test.skip(true, teacherCtx.reason);
      return;
    }
    try {
      const ok = await studentCtx.api.get('/api/v1/me/profile');
      expect(ok.status(), 'STUDENT /me/profile').toBe(200);

      const denied = await teacherCtx.api.get('/api/v1/me/profile');
      expect(denied.status(), 'TEACHER /me/profile').toBeGreaterThanOrEqual(400);
      expect(denied.status()).toBeLessThan(500);
    } finally {
      await studentCtx.api.dispose();
      await teacherCtx.api.dispose();
    }
  });

  test('RUBRICS — TENANT_ADMIN lists (200); STUDENT forbidden (4xx)', async () => {
    const adminCtx = await safeApiContextFor({ user: TENANT_ADMIN });
    if (!adminCtx.api) {
      test.skip(true, adminCtx.reason);
      return;
    }
    const studentCtx = await safeApiContextFor({ user: STUDENT });
    if (!studentCtx.api) {
      await adminCtx.api.dispose();
      test.skip(true, studentCtx.reason);
      return;
    }
    try {
      const ok = await adminCtx.api.get('/api/v1/academic/rubrics');
      expect(ok.status(), 'TA /academic/rubrics').toBeLessThan(500);
      expect([200, 204]).toContain(ok.status());

      const denied = await studentCtx.api.get('/api/v1/academic/rubrics');
      expect(denied.status(), 'STUDENT /academic/rubrics').toBeGreaterThanOrEqual(400);
      expect(denied.status()).toBeLessThan(500);
    } finally {
      await adminCtx.api.dispose();
      await studentCtx.api.dispose();
    }
  });

  test('SCHEDULE — TENANT_ADMIN section schedule endpoint responds non-5xx', async () => {
    const adminCtx = await safeApiContextFor({ user: TENANT_ADMIN });
    if (!adminCtx.api) {
      test.skip(true, adminCtx.reason);
      return;
    }
    try {
      // Unknown UUID → 404 is fine; 5xx is not.
      const res = await adminCtx.api.get(
        '/api/v1/academic/sections/00000000-0000-4000-8000-000000000001/schedule',
      );
      expect(res.status(), 'TA section schedule').toBeLessThan(500);
      expect([200, 403, 404]).toContain(res.status());
    } finally {
      await adminCtx.api.dispose();
    }
  });
});
