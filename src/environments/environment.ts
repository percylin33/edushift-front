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
  apiUrl: 'http://localhost:8081/api',
  apiVersion: 'v1',
  defaultLocale: 'es',
  supportedLocales: ['es', 'en'],
  multiTenant: {
    enabled: true,
    strategy: 'subdomain',
    headerName: 'X-Tenant-Slug',
    defaultTenant: 'demo',
  },
  auth: {
    tokenStorageKey: 'edushift.auth.token',
    refreshTokenStorageKey: 'edushift.auth.refreshToken',
    tokenHeaderName: 'Authorization',
    tokenScheme: 'Bearer',
  },
  google: {
    enabled: false,
    clientId: '',
    scopes: ['openid', 'profile', 'email'],
  },
  devMfaBypassCode: 'dev-bypass',
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
    gmailSend: false,
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
