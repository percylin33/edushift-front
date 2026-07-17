/**
 * Path constants for the {@code storageState} JSON files produced
 * by {@code e2e/tests/auth.setup.ts} and
 * {@code e2e/tests/auth.admin.setup.ts}.
 *
 * <p>Kept in a separate, dependency-free module so that other
 * specs (e.g. {@code notifications.spec.ts}, {@code reports.spec.ts})
 * can import the paths without triggering Playwright's
 * "test file should not import test file" guard for files matched
 * by the {@code setup} project's {@code testMatch}.</p>
 */
export const TENANT_ADMIN_STORAGE_STATE = 'e2e/.auth/tenant-admin.json';
export const TEACHER_STORAGE_STATE      = 'e2e/.auth/teacher.json';
export const STAFF_STORAGE_STATE        = 'e2e/.auth/staff.json';
export const PARENT_STORAGE_STATE       = 'e2e/.auth/parent.json';
export const STUDENT_STORAGE_STATE      = 'e2e/.auth/student.json';
export const SUPER_ADMIN_STORAGE_STATE  = 'e2e/.auth/super-admin.json';