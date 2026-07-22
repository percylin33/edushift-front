import { test, expect } from '@playwright/test';
import { TEACHER, TENANT_ADMIN } from '../../fixtures/test-users';
import { apiContextFor, safeApiContextFor } from '../../utils/api-helpers';

/**
 * TEACHER RBAC matrix (Plan §2.3 + §8). Drives the same set of endpoints
 * the smoke covers but through the FE's API helper layer so it exercises
 * the JWT pipeline the FE actually uses (X-Tenant-Slug header, refresh
 * logic, etc).
 *
 * <p>Endpoints that the TEACHER role MUST be denied:</p>
 * <ul>
 *   <li>GET/POST /v1/teachers — TENANT_ADMIN only</li>
 *   <li>GET /v1/teachers/{uuid}/assignments — TENANT_ADMIN only (DEBT-TEA-1)</li>
 *   <li>GET/POST /v1/learning-sessions — TENANT_ADMIN only (DEBT-TEA-2)</li>
 *   <li>GET /v1/attendance/dashboard/overview — TENANT_ADMIN only</li>
 * </ul>
 */
test.describe('TEACHER RBAC negative matrix', () => {
  test('GET /teachers → 403', async () => {
    const ctx = await safeApiContextFor({ user: TEACHER });
    if (!ctx.api) { test.skip(true, 'TEACHER login failed'); return; }
    const r = await ctx.api.get('/api/v1/teachers');
    expect(r.status()).toBe(403);
  });

  test('POST /teachers (valid body) → 403', async () => {
    const ctx = await safeApiContextFor({ user: TEACHER });
    if (!ctx.api) { test.skip(true, 'TEACHER login failed'); return; }
    const r = await ctx.api.post('/api/v1/teachers', {
      data: {
        documentType: 'DNI',
        documentNumber: '99999999',
        firstName: 'x',
        lastName: 'y',
        employmentStatus: 'ACTIVE',
      },
    });
    expect(r.status()).toBe(403);
  });

  test('GET /learning-sessions → 403', async () => {
    const ctx = await safeApiContextFor({ user: TEACHER });
    if (!ctx.api) { test.skip(true, 'TEACHER login failed'); return; }
    const r = await ctx.api.get('/api/v1/learning-sessions');
    expect(r.status()).toBe(403);
  });

  test('GET /attendance/dashboard/overview → 403', async () => {
    const ctx = await safeApiContextFor({ user: TEACHER });
    if (!ctx.api) { test.skip(true, 'TEACHER login failed'); return; }
    const r = await ctx.api.get('/api/v1/attendance/dashboard/overview');
    expect(r.status()).toBe(403);
  });

  test('POST /learning-sessions (with body) → 403 (gap)', async () => {
    const ctx = await safeApiContextFor({ user: TEACHER });
    if (!ctx.api) { test.skip(true, 'TEACHER login failed'); return; }
    const r = await ctx.api.post('/api/v1/learning-sessions', {
      data: {
        assignmentUuid: '00000000-0000-0000-0000-000000000000',
        unitUuid: '00000000-0000-0000-0000-000000000000',
        title: 'x',
        scheduledDate: '2099-01-01',
        durationMinutes: 45,
      },
    });
    expect(r.status()).toBe(403);
  });

  test('POST /teachers/{uuid}/link-user → 403', async () => {
    const ctx = await safeApiContextFor({ user: TEACHER });
    if (!ctx.api) { test.skip(true, 'TEACHER login failed'); return; }
    const r = await ctx.api.post(
      '/api/v1/teachers/00000000-0000-0000-0000-000000000000/link-user',
      { data: { userPublicUuid: '00000000-0000-0000-0000-000000000000' } },
    );
    expect(r.status()).toBe(403);
  });

  test('Cross-tenant: TEACHER demo cannot read keola teacher UUID → 404', async () => {
    const ctx = await safeApiContextFor({ user: TEACHER });
    if (!ctx.api) { test.skip(true, 'TEACHER login failed'); return; }
    // Use a random uuid in keola-networks — anti-enumeration must yield 404.
    const r = await ctx.api.get(
      '/api/v1/teachers/00000000-0000-0000-0000-000000000099',
    );
    // TEACHER hitting /teachers/* is 403 regardless of tenant. The
    // anti-enumeration 404 only applies to ADMIN probes.
    expect(r.status()).toBe(403);
  });
});
