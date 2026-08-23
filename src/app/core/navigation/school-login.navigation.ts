import { Params } from '@angular/router';
import { TenantService } from '@core/services/tenant.service';

/**
 * Keep the school identity on the login URL after logout / 401.
 *
 * Local/dev uses {@code ?tenant={slug}}. Prod subdomain already identifies
 * the school; the query param is still harmless and lets a refresh of
 * {@code /auth/login} hydrate branding without relying on cache.
 */
export function pinSchoolForLogin(tenant: TenantService): string | null {
  const snapshot = tenant.tenant();
  const slug = snapshot?.slug?.trim().toLowerCase() || null;
  if (!slug) return null;
  tenant.setTenant(snapshot, 'path');
  return slug;
}

export function schoolLoginQueryParams(
  tenant: TenantService,
  extra?: { returnUrl?: string | null },
): Params {
  const slug = pinSchoolForLogin(tenant);
  const params: Params = {};
  if (slug) params['tenant'] = slug;
  if (extra?.returnUrl) params['returnUrl'] = extra.returnUrl;
  return params;
}

/** Public accept-invite URL that hydrates the school's login branding. */
export function schoolInvitationAcceptUrl(
  origin: string,
  token: string,
  tenantSlug: string | null | undefined,
): string {
  const base = `${origin.replace(/\/$/, '')}/invitation/${encodeURIComponent(token)}`;
  const slug = tenantSlug?.trim().toLowerCase();
  if (!slug) return base;
  return `${base}?tenant=${encodeURIComponent(slug)}`;
}
