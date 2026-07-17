/**
 * Seed users for the {@code tecnosur} tenant (V39__seed_tecnosur_secondary_tech.sql).
 *
 * <p>Credentials here match the actual data left behind by Flyway
 * migration {@code V39__seed_tecnosur_secondary_tech.sql} after
 * {@code DevDataInitializer.resetSeededUserPasswords()} runs at
 * startup (see {@code edushift-back/src/main/java/com/edushift/
 * infrastructure/seed/DevDataInitializer.java}).</p>
 *
 * <p>As of the 2026-07-16 audit, the {@code demo} tenant (V38) was
 * missing the seeded teacher/staff/parent accounts in this dev
 * environment, so we use {@code tecnosur} which has the full role
 * matrix seeded (1 admin, 5 teachers, 2 staff, 1 parent).</p>
 *
 * <p>{@code DevDataInitializer} rewrites every sentinel hash to a
 * BCrypt of {@code seedPassword} — whose default is
 * {@code EduShift2026!} (override with {@code DEV_SEED_PASSWORD}).
 * Keep the value of {@link DEV_SEED_PASSWORD} and {@code SEED_PASSWORD}
 * in sync between the BE and these fixtures.</p>
 *
 * <p>If a future test needs an extra role (GUARDIAN, STUDENT-with-
 * account, etc.), add it here AND seed it in
 * {@code DevDataInitializer} or a new Flyway migration. Tests
 * should never invent credentials that the dev profile does not
 * provide: it leads to a green-CI / red-local mismatch.</p>
 */
export interface SeedUser {
  /** E-mail used as the login identifier. */
  email: string;
  /** Plaintext password; only used to call the login API. */
  password: string;
  /** Tenant slug the user belongs to (sent as the X-Tenant-Slug header). */
  tenantSlug: string;
  /** Convenience label for trace logs and screenshots. */
  label: string;
}

/**
 * Shared password used by every V38/V39-seeded account. Read from
 * {@code DEV_SEED_PASSWORD} so a developer can override it on a
 * custom backend without editing this file. Keep aligned with
 * {@code dev.seed.password} on the backend.
 */
export const DEV_SEED_PASSWORD: string =
  process.env['DEV_SEED_PASSWORD'] ?? 'EduShift2026!';

export const TENANT_ADMIN: SeedUser = {
  email: 'admin@tecnosur.edushift.pe',
  password: DEV_SEED_PASSWORD,
  tenantSlug: 'tecnosur',
  label: 'Tenant Admin (tecnosur)',
};

// V39 seeds five TEACHER accounts in `tecnosur`. We pick one as the
// canonical fixture and the others stay in V39 for ad-hoc tests.
export const TEACHER: SeedUser = {
  email: 'mariela.paredes@tecnosur.edushift.pe',
  password: DEV_SEED_PASSWORD,
  tenantSlug: 'tecnosur',
  label: 'Teacher — Mariela Paredes (tecnosur)',
};

export const TEACHER_ALT: SeedUser = {
  email: 'cesar.ortega@tecnosur.edushift.pe',
  password: DEV_SEED_PASSWORD,
  tenantSlug: 'tecnosur',
  label: 'Teacher — César Ortega (tecnosur)',
};

// V39 seeds two STAFF accounts in `tecnosur`.
export const STAFF: SeedUser = {
  email: 'coordinador@tecnosur.edushift.pe',
  password: DEV_SEED_PASSWORD,
  tenantSlug: 'tecnosur',
  label: 'Staff — Coordinador Académico (tecnosur)',
};

// V39 seeds one PARENT/GUARDIAN account in `tecnosur`.
export const PARENT: SeedUser = {
  email: 'padre.tecnosur@tecnosur.edushift.pe',
  password: DEV_SEED_PASSWORD,
  tenantSlug: 'tecnosur',
  label: 'Parent (tecnosur)',
};

// STUDENT user seeded by Flyway V74 (`V74__seed_student_and_keola.sql`).
// Lucia Estudiante Demo — the canonical STUDENT login used by the LMS
// RBAC matrix and student-side E2E specs (task submissions, quiz
// attempts, attendance justifications).
export const STUDENT: SeedUser = {
  email: 'lucia.student@tecnosur.edushift.pe',
  password: DEV_SEED_PASSWORD,
  tenantSlug: 'tecnosur',
  label: 'Student — Lucia Estudiante Demo (tecnosur)',
};

// Cross-tenant isolation: V39 only seeds `tecnosur`, so the
// cross-tenant test uses a different slug (keola-networks has a
// real account but no full role matrix). The "TA of tenant A
// cannot read student of tenant B" spec will skip when B cannot
// authenticate; the "tenant slug swap" spec only needs a
// distinct slug string.
export const TENANT_ADMIN_B: SeedUser = {
  email: 'admin@keola-networks.edushift.pe',
  password: DEV_SEED_PASSWORD,
  tenantSlug: 'keola-networks',
  label: 'Tenant Admin B (keola-networks — placeholder, may skip)',
};