import type { AppEnvironment } from './environment.model';

/**
 * Default environment (development).
 * Replaced at build time by Angular's `fileReplacements` for production.
 */
export const environment: AppEnvironment = {
  production: false,
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
  }
};
