import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';
import { PARENT } from '../fixtures/test-users';

/**
 * Family module E2E — verifies parent-facing endpoints for linked children.
 *
 * <p>Covers:</p>
 * <ol>
 *   <li>List children linked to the parent</li>
 *   <li>Get child attendance records</li>
 *   <li>Get child grades</li>
 *   <li>Get child payments</li>
 *   <li>Verify parent cannot access unlinked student data</li>
 * </ol>
 *
 * <p>Skipped by default; enable via {@code npx playwright test family-api}
 * once the BE is running locally.</p>
 */

const PREFIX = '/v1';

test.describe('Family module — parent access (live BE required)', () => {
  test.skip(true, 'BE must be reachable at localhost:8080');

  test('parent can list linked children', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      // Login as parent
      const loginRes = await ctx.post(`${PREFIX}/auth/login`, {
        data: { email: PARENT.email, password: PARENT.password },
      });
      expect(loginRes.status()).toBe(200);
      const session = await loginRes.json();

      // List children
      const childrenRes = await ctx.get(`${PREFIX}/family/children`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'X-Tenant-Slug': PARENT.tenantSlug,
        },
      });
      expect(childrenRes.status()).toBe(200);
      const body = await childrenRes.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  test('parent can get child attendance', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const loginRes = await ctx.post(`${PREFIX}/auth/login`, {
        data: { email: PARENT.email, password: PARENT.password },
      });
      const session = await loginRes.json();

      // First get children to find a valid student UUID
      const childrenRes = await ctx.get(`${PREFIX}/family/children`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'X-Tenant-Slug': PARENT.tenantSlug,
        },
      });
      const children = await childrenRes.json();
      if (children.data.length === 0) {
        test.skip(true, 'No linked children found');
        return;
      }

      const studentUuid = children.data[0].publicUuid;
      const attendanceRes = await ctx.get(
        `${PREFIX}/family/children/${studentUuid}/attendance`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'X-Tenant-Slug': PARENT.tenantSlug,
          },
        }
      );
      expect(attendanceRes.status()).toBe(200);
      const body = await attendanceRes.json();
      expect(body.success).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  test('parent can get child grades', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const loginRes = await ctx.post(`${PREFIX}/auth/login`, {
        data: { email: PARENT.email, password: PARENT.password },
      });
      const session = await loginRes.json();

      const childrenRes = await ctx.get(`${PREFIX}/family/children`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'X-Tenant-Slug': PARENT.tenantSlug,
        },
      });
      const children = await childrenRes.json();
      if (children.data.length === 0) {
        test.skip(true, 'No linked children found');
        return;
      }

      const studentUuid = children.data[0].publicUuid;
      const gradesRes = await ctx.get(
        `${PREFIX}/family/children/${studentUuid}/grades`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'X-Tenant-Slug': PARENT.tenantSlug,
          },
        }
      );
      expect(gradesRes.status()).toBe(200);
      const body = await gradesRes.json();
      expect(body.success).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  test('parent can get child payments', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const loginRes = await ctx.post(`${PREFIX}/auth/login`, {
        data: { email: PARENT.email, password: PARENT.password },
      });
      const session = await loginRes.json();

      const childrenRes = await ctx.get(`${PREFIX}/family/children`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'X-Tenant-Slug': PARENT.tenantSlug,
        },
      });
      const children = await childrenRes.json();
      if (children.data.length === 0) {
        test.skip(true, 'No linked children found');
        return;
      }

      const studentUuid = children.data[0].publicUuid;
      const paymentsRes = await ctx.get(
        `${PREFIX}/family/children/${studentUuid}/payments`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'X-Tenant-Slug': PARENT.tenantSlug,
          },
        }
      );
      expect(paymentsRes.status()).toBe(200);
      const body = await paymentsRes.json();
      expect(body.success).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  test('parent cannot access unlinked student data (403)', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const loginRes = await ctx.post(`${PREFIX}/auth/login`, {
        data: { email: PARENT.email, password: PARENT.password },
      });
      const session = await loginRes.json();

      // Try to access a random student UUID (not linked to this parent)
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const res = await ctx.get(
        `${PREFIX}/family/children/${fakeUuid}/attendance`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'X-Tenant-Slug': PARENT.tenantSlug,
          },
        }
      );
      // Should be 403 Forbidden or 404 Not Found (anti-enumeration)
      expect([403, 404]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });
});
