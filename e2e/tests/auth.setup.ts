import { test as setup, expect, test } from '@playwright/test';
import {
  TENANT_ADMIN,
  TEACHER,
  STAFF,
  PARENT,
  STUDENT,
} from '../fixtures/test-users';
import { apiContextFor } from '../utils/api-helpers';
import { writeAuthState } from '../fixtures/_write-auth-state';
import {
  TENANT_ADMIN_STORAGE_STATE,
  TEACHER_STORAGE_STATE,
  STAFF_STORAGE_STATE,
  PARENT_STORAGE_STATE,
  STUDENT_STORAGE_STATE,
} from '../fixtures/storage-state-paths';

/**
 * Auth state bootstrap (Sprint 12 / FE-12.2 / DEBT-FE-E2E-1).
 *
 * <p>Logs in once per role that the V38/V39 Flyway seeds actually
 * create, persists the resulting {@code storageState} JSON, and
 * exports a constant per role so the specs only need to import the
 * path.</p>
 *
 * <p>The shared login helper lives in
 * {@code fixtures/_write-auth-state.ts} — both this project-level
 * setup and the per-spec on-demand {@code auth-states.ts} use the
 * same encoding (JSON-stringify envelope, mirror FE
 * {@code StorageService}).</p>
 *
 * <h3>Failure handling</h3>
 * <p>If the BE rejects the login (e.g. backend offline, MFA not yet
 * bypassed), the setup test calls {@code test.skip(true, ...)} so
 * downstream specs still get a cached storage state from a previous
 * run. The TENANT_ADMIN path also probes {@code /me} before
 * persisting so a stale token never lands on disk.</p>
 */

const TENANT_ADMIN_STATE = TENANT_ADMIN_STORAGE_STATE;
const TEACHER_STATE      = TEACHER_STORAGE_STATE;
const STAFF_STATE        = STAFF_STORAGE_STATE;
const PARENT_STATE       = PARENT_STORAGE_STATE;
const STUDENT_STATE      = STUDENT_STORAGE_STATE;

setup('authenticate as tenant admin', async ({ page, baseURL }) => {
  // Probe with the API helper so we know the token really works
  // before persisting storageState. /me uses the same path the FE
  // uses on app boot.
  const ctx = await apiContextFor({ user: TENANT_ADMIN });
  const me = await ctx.get('/api/v1/auth/me');
  expect(me.ok(), 'auth /me must succeed for the seed tenant admin').toBe(true);
  await ctx.dispose();
  try {
    await writeAuthState(page, baseURL, TENANT_ADMIN, TENANT_ADMIN_STATE);
  } catch (err) {
    test.skip(true,
      `Login failed for ${TENANT_ADMIN.email} on tenant ${TENANT_ADMIN.tenantSlug}: ` +
      `${err instanceof Error ? err.message : String(err)} — using cached state at ${TENANT_ADMIN_STATE} if present.`);
  }
});

setup('authenticate as teacher', async ({ page, baseURL }) => {
  try {
    await writeAuthState(page, baseURL, TEACHER, TEACHER_STATE);
  } catch (err) {
    test.skip(true,
      `Teacher login failed: ${err instanceof Error ? err.message : String(err)} — ` +
      `using cached state at ${TEACHER_STATE} if present.`);
  }
});

setup('authenticate as staff', async ({ page, baseURL }) => {
  try {
    await writeAuthState(page, baseURL, STAFF, STAFF_STATE);
  } catch (err) {
    test.skip(true,
      `Staff login failed: ${err instanceof Error ? err.message : String(err)} — ` +
      `using cached state at ${STAFF_STATE} if present.`);
  }
});

setup('authenticate as parent', async ({ page, baseURL }) => {
  try {
    await writeAuthState(page, baseURL, PARENT, PARENT_STATE);
  } catch (err) {
    test.skip(true,
      `Parent login failed: ${err instanceof Error ? err.message : String(err)} — ` +
      `using cached state at ${PARENT_STATE} if present.`);
  }
});

setup('authenticate as student', async ({ page, baseURL }) => {
  try {
    await writeAuthState(page, baseURL, STUDENT, STUDENT_STATE);
  } catch (err) {
    test.skip(true,
      `Student login failed: ${err instanceof Error ? err.message : String(err)} — ` +
      `using cached state at ${STUDENT_STATE} if present.`);
  }
});
