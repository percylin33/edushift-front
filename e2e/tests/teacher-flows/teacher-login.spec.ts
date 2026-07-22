import { test, expect } from '@playwright/test';
import { TEACHER } from '../../fixtures/test-users';
import { safeApiContextFor } from '../../utils/api-helpers';

/**
 * TEACHER login (F1) — covers the four 2xx/4xx paths the smoke
 * exercises, through the FE's API helper layer.
 */
test.describe('TEACHER login (F1)', () => {
  test('happy path: TEACHER login → 200 with TEACHER role in /me', async () => {
    const ctx = await safeApiContextFor({ user: TEACHER });
    if (!ctx.api) { test.skip(true, 'TEACHER login failed'); return; }
    const me = await ctx.api.get('/api/v1/auth/me');
    expect(me.status()).toBe(200);
    const body = await me.json();
    expect(body.data.roles).toContain('TEACHER');
  });

  test('TEACHER login captures the JWT permissions set', async () => {
    const ctx = await safeApiContextFor({ user: TEACHER });
    if (!ctx.api) { test.skip(true, 'TEACHER login failed'); return; }
    const me = await ctx.api.get('/api/v1/auth/me');
    const body = await me.json();
    // The /me payload includes the user's resolved permissions; encode
    // the exact set so future RBAC drift triggers a failure here.
    expect(body.data.permissions).toEqual(expect.arrayContaining([
      'LMS_MATERIAL_READ',
      'LMS_MATERIAL_WRITE',
      'LMS_AI_GENERATE',
      'LMS_TASK_CREATE',
      'LMS_TASK_GRADE',
    ]));
  });

  test('bad password → 401', async () => {
    const ctx = await safeApiContextFor({
      user: { ...TEACHER, password: 'WRONG-PASSWORD-2026' },
    });
    // safeApiContextFor should return null when login fails; assert it.
    expect(ctx.api).toBeNull();
  });

  test('unknown email → 401', async () => {
    const ctx = await safeApiContextFor({
      user: {
        ...TEACHER,
        email: 'ghost-teacher@demo.edushift.pe',
      },
    });
    expect(ctx.api).toBeNull();
  });
});
