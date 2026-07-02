/**
 * Application roles. Mirrors the backend {@code UserRole} enum verbatim
 * (UPPER_CASE strings) so role checks against the backend payload don't
 * need a translation step.
 *
 * <p>{@code TENANT_ADMIN}, {@code TEACHER}, {@code STUDENT},
 * {@code GUARDIAN}, {@code STAFF}, and {@code SUPER_ADMIN} match the
 * Java enum constants one-to-one. {@code GUEST} is a frontend-only
 * placeholder used by the navigation when no role is loaded.
 */
export enum UserRole {
  SuperAdmin = 'SUPER_ADMIN',
  TenantAdmin = 'TENANT_ADMIN',
  Staff = 'STAFF',
  Teacher = 'TEACHER',
  Student = 'STUDENT',
  Guardian = 'GUARDIAN',
  Guest = 'GUEST',
}
