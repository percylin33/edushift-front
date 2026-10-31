import { Params } from '@angular/router';
import { TenantService } from '@core/services/tenant.service';
import { isLocalhostOrigin, tenantOriginForSlug } from './tenant-host';

/**
 * Keep the school identity on the login URL after logout / 401.
 *
 * On local hosts the hostname identifies the school; non-local legacy
 * deployments keep their existing query-based link behavior.
 */
export function pinSchoolForLogin(tenant: TenantService): string | null {
  const snapshot = tenant.tenant();
  const slug = snapshot?.slug?.trim().toLowerCase() || null;
  if (!slug) return null;
  tenant.setTenant(snapshot, 'subdomain');
  return slug;
}

export function schoolLoginQueryParams(
  tenant: TenantService,
  extra?: { returnUrl?: string | null },
): Params {
  const slug = pinSchoolForLogin(tenant);
  const params: Params = {};
  if (slug && !isLocalhostOrigin(window.location.origin)) params['tenant'] = slug;
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
  if (isLocalhostOrigin(origin)) {
    const path = `/invitation/${encodeURIComponent(token)}`;
    return new URL(path, tenantOriginForSlug(origin, slug)).toString();
  }
  return `${base}?tenant=${encodeURIComponent(slug)}`;
}
