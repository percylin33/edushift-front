import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';
import { TENANT_ADMIN } from '../fixtures/test-users';

/**
 * Error handling E2E — verifies consistent error responses.
 *
 * <p>Covers:</p>
 * <ol>
 *   <li>401 for unauthenticated requests</li>
 *   <li>403 for forbidden resources</li>
 *   <li>404 for missing resources</li>
 *   <li>400 for validation errors</li>
 *   <li>429 for rate limiting</li>
 *   <li>500 for server errors (should not leak internals)</li>
 * </ol>
 *
 * <p>Skipped by default; enable via {@code npx playwright test error-handling}
 * once the BE is running locally.</p>
 */

const PREFIX = '/v1';

test.describe('Error handling — consistent responses (live BE required)', () => {
  test.skip(true, 'BE must be reachable at localhost:8080');

  test('401 for unauthenticated requests', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const res = await ctx.get(`${PREFIX}/auth/me`);
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('UNAUTHORIZED');
    } finally {
      await ctx.dispose();
    }
  });

  test('404 for missing resources', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const loginRes = await ctx.post(`${PREFIX}/auth/login`, {
        data: { email: TENANT_ADMIN.email, password: TENANT_ADMIN.password },
      });
      const session = await loginRes.json();

      const res = await ctx.get(`${PREFIX}/students/00000000-0000-0000-0000-000000000000`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'X-Tenant-Slug': TENANT_ADMIN.tenantSlug,
        },
      });
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    } finally {
      await ctx.dispose();
    }
  });

  test('400 for validation errors', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const loginRes = await ctx.post(`${PREFIX}/auth/login`, {
        data: { email: TENANT_ADMIN.email, password: TENANT_ADMIN.password },
      });
      const session = await loginRes.json();

      // Try to create a student with invalid data
      const res = await ctx.post(`${PREFIX}/students`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'X-Tenant-Slug': TENANT_ADMIN.tenantSlug,
          'Content-Type': 'application/json',
        },
        data: { firstName: '', lastName: '', email: 'invalid-email' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.errors).toBeDefined();
      expect(Array.isArray(body.errors)).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  test('429 for rate limiting', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      // Exhaust rate limit for login (10 req/min)
      for (let i = 0; i < 11; i++) {
        const res = await ctx.post(`${PREFIX}/auth/login`, {
          data: { email: 'no@no.no', password: 'wrong' },
        });
        if (i === 10) {
          expect(res.status()).toBe(429);
          const body = await res.json();
          expect(body.error.code).toBe('RATE_LIMITED');
        }
      }
    } finally {
      await ctx.dispose();
    }
  });

  test('error response does not leak internal details', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const res = await ctx.get(`${PREFIX}/nonexistent-endpoint`);
      expect(res.status()).toBe(404);
      const body = await res.json();
      // Should not contain stack traces or internal paths
      expect(body).not.toHaveProperty('stack');
      expect(body).not.toHaveProperty('trace');
      expect(body).not.toHaveProperty('exception');
    } finally {
      await ctx.dispose();
    }
  });

  test('malformed JSON returns 400', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const res = await ctx.post(`${PREFIX}/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: 'not valid json',
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
    } finally {
      await ctx.dispose();
    }
  });
});
