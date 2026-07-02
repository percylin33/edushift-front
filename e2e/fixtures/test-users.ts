/**
 * Seed users for the {@code demo} tenant (Sprint 12 / FE-12.1).
 *
 * <p>Credentials here match {@code DevDataInitializer} on the backend
 * (see {@code edushift-back/src/main/java/com/edushift/infrastructure/seed/DevDataInitializer.java}).
 * That bean is {@code @Profile("dev")}, so these creds are only
 * valid against a dev backend — not staging or production.</p>
 *
 * <p>If a future test needs an extra role (TEACHER, GUARDIAN,
 * STUDENT), add it here AND seed it in {@code DevDataInitializer}.
 * Tests should never invent credentials that the dev profile
 * doesn't provide: it leads to a green-CI / red-local mismatch.</p>
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

export const TENANT_ADMIN: SeedUser = {
  email: 'admin@demo.edushift.pe',
  password: 'Edushift123!',
  tenantSlug: 'demo',
  label: 'Tenant Admin (demo)',
};
