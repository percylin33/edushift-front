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
  // Localhost variants (Angular dev server, dev proxy, docker-compose).
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    // Preserve the dev port from the build-time URL so the dev team can
    // move 8081 → 8082 without rebuilding.
    try {
      const built = new URL(builtInApiUrl);
      return `${window.location.protocol}//${window.location.hostname}:${built.port}${built.pathname.replace(/\/$/, '')}`;
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
