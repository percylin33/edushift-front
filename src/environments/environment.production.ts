import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: true,
  appName: 'EduShift',
  appVersion: '0.0.0',
  apiUrl: 'https://api.edushift.app/api',
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
    students: true,
    academic: true,
    attendance: true,
    payments: true,
    ai: true,
    reports: true,
    notifications: true,
    settings: true
  },
  logging: {
    level: 'warn',
    enableRemote: true
  }
};
