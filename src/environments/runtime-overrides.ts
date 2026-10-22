import type { AppEnvironment } from './environment.model';

/**
 * Runtime overrides for `apiUrl`. Used by the bundle to resolve the
 * backend host without hard-coding environment-specific URLs at build
 * time. The detection lives here (not in `environment.model.ts`) so that
 * production builds default to the production URL unless the page is
 * served from localhost, a tunnel, or a Vercel preview.
 *
 * <p>Why this exists: EduShift runs on Render (production) and locally
 * on Docker / docker-compose (development). Both backends are reachable
 * from any client over the internet, but the dev backend is on the
 * developer's machine only. If the build always bakes in the prod URL,
 * the developer cannot test from their own browser; if it always bakes
 * in localhost, the live site cannot talk to Render. The
 * {@link resolveApiUrl} helper picks the right one based on
 * {@code window.location.hostname}.</p>
 */
function resolveApiUrl(builtInApiUrl: string): string {
  if (typeof window === 'undefined') {
    // SSR or non-browser context — trust the build-time value.
    return builtInApiUrl;
  }
  const host = window.location.hostname.toLowerCase();
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
      const port = built.port || '8081';
      return `${window.location.protocol}//${window.location.hostname}:${port}${built.pathname.replace(/\/$/, '')}`;
    } catch {
      return builtInApiUrl;
    }
  }
  // Public tunnels: same-origin `/api` so `ng serve` proxy → local BE works.
  // Without this, the browser would call `http://localhost:8081` on the
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
