/**
 * Billing tier of a {@link com.edushift.modules.tenants.entity.Tenant}.
 * Mirrors the backend `TenantPlan.java` enum one-to-one.
 *
 * <p>Self-signup always lands on {@link #Trial}. Promotion to a paid tier
 * happens server-side once billing is wired (post-Sprint 2). The plan
 * gates feature flags and capacity limits ({@code maxStudents},
 * {@code maxTeachers}); the client treats the field as informational and
 * defers to the server for enforcement.
 */
export enum TenantPlan {
  Trial = 'TRIAL',
  Basic = 'BASIC',
  Pro = 'PRO',
  Enterprise = 'ENTERPRISE'
}
