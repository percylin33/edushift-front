/** Hostname helpers for tenant URLs in local development. */
export function isLocalhostOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

/** Legacy tenant slugs may contain dashes; local host labels never do. */
export function tenantHostnameAlias(slug: string): string {
  return slug.trim().toLowerCase().replace(/-/g, '');
}

/** Build a tenant-local origin while preserving protocol and port. */
export function tenantOriginForSlug(origin: string, slug: string): string {
  const url = new URL(origin);
  if (!isLocalhostOrigin(url.origin)) return url.origin;

  const alias = tenantHostnameAlias(slug);
  if (!/^[a-z0-9][a-z0-9]{0,62}$/.test(alias)) return url.origin;
  url.hostname = `${alias}.localhost`;
  return url.origin;
}

export function tenantUrlForSlug(origin: string, slug: string, path: string): string {
  return new URL(path, tenantOriginForSlug(origin, slug)).toString();
}
