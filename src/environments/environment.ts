import type { AppEnvironment } from './environment.model';

/**
 * Default environment (development).
 * Replaced at build time by Angular's `fileReplacements` for production.
 */
export const environment: AppEnvironment = {
  production: false,
  uatMode: true,
  appName: 'EduShift',
  appVersion: '0.0.0',
  apiUrl: 'https://3vmchk6t-8081.brs.devtunnels.ms/api',
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
    enabled: true,
    // Dev placeholder. REPLACE with the real OAuth Client ID from
    // Google Cloud Console → APIs & Services → Credentials.
    // Authorized JavaScript origins must include this app's origin
    // (e.g. http://localhost:4200 in dev, https://app.edushift.app in prod).
    clientId: 'REPLACE_ME_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com',
    scopes: [
      'openid',
      'profile',
      'email',
      // PR-2 will add https://www.googleapis.com/auth/gmail.send here
      // and request consent via SocialAuthService additional consents.
    ],
  },
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
};
