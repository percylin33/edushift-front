/**
 * Lifecycle status of a {@link com.edushift.modules.tenants.entity.Tenant}.
 * Mirrors the backend `TenantStatus.java` enum one-to-one.
 *
 * <p>Only {@code ACTIVE} tenants can authenticate. {@code PENDING} is the
 * status assigned by self-signup ({@code POST /v1/tenants/register}) — the
 * tenant becomes {@code ACTIVE} once the admin completes the onboarding.
 * The 401 surfaced by the backend in non-{@code ACTIVE} cases carries the
 * {@code TENANT_INACTIVE} error code.
 */
export enum TenantStatus {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
  Inactive = 'INACTIVE',
}
