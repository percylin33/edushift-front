import type { AppEnvironment } from './environment.model';
import { runtimeOverrides } from './runtime-overrides';

/**
 * Default environment. At build time Angular's `fileReplacements`
 * swaps this for `environment.development.ts` (ng serve) or
 * `environment.production.ts` (ng build --configuration production).
 *
 * <p>The `apiUrl` below is rewritten at <em>runtime</em> by
 * {@link runtimeOverrides} so a single bundle works for both the local
 * docker-compose dev backend and the Render production backend. We
 * keep a sensible default here so SSR / tests that lack
 * {@code window.location} still get a working value.</p>
 */
export const environment: AppEnvironment = runtimeOverrides({
  production: false,
  uatMode: true,
  appName: 'EduShift',
  appVersion: '0.0.0',
  apiUrl: 'http://localhost:8080/api',
  apiVersion: 'v1',
  defaultLocale: 'es',
  supportedLocales: ['es', 'en'],
  multiTenant: {
    enabled: true,
    strategy: 'subdomain',
    headerName: 'X-Tenant-Slug',
    // Auth login requires URL identity locally: /auth/login?tenant=tecnosur
    defaultTenant: 'demo',
  },
  auth: {
    tokenStorageKey: 'edushift.auth.token',
    refreshTokenStorageKey: 'edushift.auth.refreshToken',
    tokenHeaderName: 'Authorization',
    tokenScheme: 'Bearer',
    // SECURITY FIX: Send cookies with every request (httpOnly token storage)
    withCredentials: true,
  },
  google: {
    enabled: false,
    clientId: '',
    scopes: ['openid', 'profile', 'email'],
  },
  // MFA enrollment stays interactive by default; enable only for deliberate
  // testing of the dev-only bypass endpoint.
  devMfaBypassCode: undefined,
  features: {
    dashboard: true,
    auth: true,
    users: true,
    students: true,
    teachers: true,
    academic: true,
    sessions: true,
    evaluations: true,
    rubrics: true,
    attendance: true,
    payments: true,
    ai: true,
    reports: true,
    notifications: true,
    settings: true,
    lms: true,
    // FIX BUG-2026-07-30-09 / -10 / -18 / -19: same as
    // environment.development.ts — declare the routes that are wired
    // with featureFlagGuard so the guard doesn't fall through to false.
    announcements: true,
    schedule: true,
    family: true,
    disclosures: true,
    admissions: true,
    me: true,
    gmailSend: true,
  },
  logging: {
    level: 'debug',
    enableRemote: false,
  },
  attendance: {
    scannerEngine: 'zxing-ngx',
    scanCooldownMs: 1200,
    feedbackDismissMs: 1200,
    offlineBannerCopy: 'Sin conexión. Vuelve a conectarte para escanear.',
    pwaDisplay: 'standalone',
    pwaStartUrl: '/attendance/scanner',
  },
});
