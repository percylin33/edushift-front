/**
 * Body of `POST /v1/tenants/register` — invite-gated school setup.
 *
 * <p>Sent by {@code /auth/setup-school?token=}. The backend redeems the
 * Super-Admin invitation, creates the tenant ({@code PENDING} + {@code TRIAL})
 * and the admin user ({@code ACTIVE}, role {@code TENANT_ADMIN}) atomically,
 * and returns an {@code AuthResponse} so the form can jump into onboarding.
 *
 * <h3>Validation expected by the backend</h3>
 * <ul>
 *   <li>{@code tenantSlug}: 2–80 chars, lowercase alphanumeric + dashes,
 *       must not collide with an existing slug (409
 *       {@code TENANT_SLUG_TAKEN}).</li>
 *   <li>{@code adminEmail}: RFC 5322; per-tenant uniqueness is enforced
 *       at the partial unique index {@code uk_users_tenant_email_active}.</li>
 *   <li>{@code adminPassword}: 8–128 chars (no complexity rule yet — that
 *       lives in the front-end policy registry).</li>
 *   <li>{@code inviteToken}: opaque Super-Admin invitation (16–128 chars).</li>
 *   <li>{@code adminFirstName} / {@code adminLastName}: 1–100 chars.</li>
 * </ul>
 */
export interface RegisterTenantRequest {
  tenantName: string;
  tenantSlug: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  inviteToken: string;
}
