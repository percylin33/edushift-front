import type { AppEnvironment } from './environment.model';

/**
 * Runtime overrides for `apiUrl`. Used by the bundle to resolve the
 * backend host without hard-coding environment-specific URLs at build
 * time. The detection lives here (not in `environment.model.ts`) so that
 * production builds default to the Contabo application URL unless the page
 * is served from a local development host or a public tunnel.
 *
 * <p>Why this exists: EduShift runs on Contabo (production) and locally
 * on Docker / docker-compose (development). If the build always bakes in
 * localhost, the live site cannot reach the production backend. The
 * {@link resolveApiUrl} helper picks the right one based on
 * {@code window.location.hostname}.</p>
 */
export function resolveApiUrl(builtInApiUrl: string, hostname?: string): string {
  if (typeof window === 'undefined' && hostname === undefined) {
    // SSR or non-browser context — trust the build-time value.
    return builtInApiUrl;
  }
  const host = (hostname ?? window.location.hostname).toLowerCase();
  // Production DNS serves Angular and its same-origin API through Contabo
  // Nginx. Keep auth cookies same-site and host-only on app and tenant hosts.
  if (host === 'edushift.pe' || host.endsWith('.edushift.pe')) {
    return '/api';
  }
  // Tenant pages on `<slug>.localhost` use a same-origin API URL. The dev
  // server and local Docker Nginx proxy `/api` to the backend, avoiding
  // cross-port browser restrictions while keeping host-only auth cookies.
  if (host.endsWith('.localhost')) {
    return '/api';
  }
  // Root localhost variants keep the direct backend URL for local workflows.
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0'
  ) {
    // Preserve the dev port from the build-time URL. Production URLs have
    // no explicit port, so fall back to the local Compose backend port.
    try {
      const built = new URL(builtInApiUrl);
      const port = built.port || '8080';
      return `${window.location.protocol}//${window.location.hostname}:${port}${built.pathname.replace(/\/$/, '')}`;
    } catch {
      return builtInApiUrl;
    }
  }
  // Public tunnels: same-origin `/api` so `ng serve` proxy → local BE works.
  // Without this, the browser would call `http://localhost:8080` on the
  // remote device and fail.
  if (
    host.endsWith('.trycloudflare.com') ||
    host.endsWith('.loca.lt') ||
    host.endsWith('.devtunnels.ms') ||
    host.endsWith('.ngrok-free.app') ||
    host.endsWith('.ngrok.io') ||
    host.endsWith('.ngrok.app') ||
    host.endsWith('.ngrok.dev') ||
    host.endsWith('.lhr.life')
  ) {
    return '/api';
  }
  return builtInApiUrl;
}

export function runtimeOverrides(env: AppEnvironment): AppEnvironment {
  if (typeof window === 'undefined') return env;
  return {
    ...env,
    apiUrl: resolveApiUrl(env.apiUrl),
  };
}
