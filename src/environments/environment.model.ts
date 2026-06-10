/**
 * Shared environment shape. Lives in its own file so that `fileReplacements`
 * (which swaps `environment.ts` per configuration) does not break the type
 * import from `environment.development.ts` / `environment.production.ts`.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type TenantStrategy = 'subdomain' | 'path' | 'header';

export interface AppEnvironment {
  production: boolean;
  appName: string;
  appVersion: string;
  apiUrl: string;
  apiVersion: string;
  defaultLocale: string;
  supportedLocales: readonly string[];
  multiTenant: {
    enabled: boolean;
    strategy: TenantStrategy;
    headerName: string;
    defaultTenant: string;
  };
  auth: {
    tokenStorageKey: string;
    refreshTokenStorageKey: string;
    tokenHeaderName: string;
    tokenScheme: string;
  };
  features: {
    dashboard: boolean;
    auth: boolean;
    users: boolean;
    students: boolean;
    teachers: boolean;
    academic: boolean;
    sessions: boolean;
    evaluations: boolean;
    rubrics: boolean;
    attendance: boolean;
    payments: boolean;
    ai: boolean;
    reports: boolean;
    notifications: boolean;
    settings: boolean;
  };
  logging: {
    level: LogLevel;
    enableRemote: boolean;
  };
}
