/**
 * Body of `POST /v1/tenants/register` — the public self-signup endpoint.
 *
 * <p>Sent by the {@code /auth/register} screen (FE-2.2). The backend
 * creates the tenant ({@code PENDING} + {@code TRIAL}) and the admin user
 * ({@code ACTIVE}, role {@code TENANT_ADMIN}) atomically and returns an
 * {@code AuthResponse}, so the form has only to redirect to the
 * onboarding flow once the request resolves — no extra login round-trip
 * is needed.
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
}
