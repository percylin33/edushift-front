/**
 * Shared environment shape. Lives in its own file so that `fileReplacements`
 * (which swaps `environment.ts` per configuration) does not break the type
 * import from `environment.development.ts` / `environment.production.ts`.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type TenantStrategy = 'subdomain' | 'path' | 'header';

/**
 * QR scanner engine selection (FE-6.1).
 *
 * <h3>Why a flag</h3>
 * The default engine is {@code zxing-ngx} because of its strong
 * TypeScript types and the fact that we already depend on the
 * underlying {@code @zxing/browser} decoder. {@code html5-qrcode} is
 * kept as a fallback for devices where the Angular wrapper's
 * signal-based lifecycle misbehaves (older iOS Safari, certain
 * Android WebView builds).
 */
export type AttendanceScannerEngine = 'zxing-ngx' | 'html5-qrcode';

export interface AttendanceScannerConfig {
  /** QR decoder engine. */
  scannerEngine: AttendanceScannerEngine;
  /** Minimum gap between two successful scans (anti double-trigger). */
  scanCooldownMs: number;
  /** Auto-dismiss window for the feedback chip after a successful scan. */
  feedbackDismissMs: number;
  /** Banner copy shown when the device is offline. */
  offlineBannerCopy: string;
  /** PWA install mode (`standalone` recommended for the scanner). */
  pwaDisplay: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  /** Default route opened when launching the PWA from the home screen. */
  pwaStartUrl: string;
}

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
  attendance: AttendanceScannerConfig;
}
