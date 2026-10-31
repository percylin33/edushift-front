import { isLocalhostOrigin, tenantUrlForSlug } from '@core/navigation/tenant-host';

/** Build the public school login URL. Local schools use dash-free subdomains. */
export function tenantPublicUrl(slug: string, origin = window.location.origin): string {
  const base = origin.replace(/\/$/, '');
  if (isLocalhostOrigin(origin)) return tenantUrlForSlug(origin, slug, '/auth/login');
  return `${base}/auth/login?tenant=${encodeURIComponent(slug.trim().toLowerCase())}`;
}
