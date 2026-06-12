import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  appName: 'EduShift',
  appVersion: '0.0.0-dev',
  apiUrl: 'https://3vmchk6t-8080.brs.devtunnels.ms/api',
  apiVersion: 'v1',
  defaultLocale: 'es',
  supportedLocales: ['es', 'en'],
  multiTenant: {
    enabled: true,
    strategy: 'subdomain',
    headerName: 'X-Tenant-Slug',
    defaultTenant: 'demo'
  },
  auth: {
    tokenStorageKey: 'edushift.auth.token',
    refreshTokenStorageKey: 'edushift.auth.refreshToken',
    tokenHeaderName: 'Authorization',
    tokenScheme: 'Bearer'
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
    settings: true
  },
  logging: {
    level: 'debug',
    enableRemote: false
  },
  attendance: {
    scannerEngine: 'zxing-ngx',
    scanCooldownMs: 1200,
    feedbackDismissMs: 1200,
    offlineBannerCopy: 'Sin conexión. Vuelve a conectarte para escanear.',
    pwaDisplay: 'standalone',
    pwaStartUrl: '/attendance/scanner'
  }
};
