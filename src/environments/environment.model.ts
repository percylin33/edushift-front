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

export interface GoogleAuthConfig {
  /**
   * Master switch. When false the Google Sign-in button is hidden on the
   * FE and the corresponding endpoint on the BE returns 401
   * `GOOGLE_PROVIDER_DISABLED`. The two switches must agree: flipping
   * only one will produce a confusing UX (button → 401, no button → 404).
   */
  enabled: boolean;
  /** OAuth 2.0 Client ID issued by Google Cloud Console. */
  clientId: string;
  /**
   * Scopes requested on first sign-in. Keep narrow: only ask for what
   * the app actively uses. `openid profile email` is mandatory for the
   * id_token flow; `https://www.googleapis.com/auth/gmail.send` is the
   * "send email" scope (gated separately by the Gmail Send module).
   */
  scopes: readonly string[];
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
  /**
   * Google OAuth client wired by `angularx-social-login`. Only consulted
   * when the parent deploy opts in via {@link GoogleAuthConfig.enabled}.
   * The Client ID is **public** (it's published in the FE bundle by
   * Google's own design) — the security boundary is the BE-side JWKS
   * signature check, not hiding the ID.
   */
  google: GoogleAuthConfig;
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
    lms: boolean;
    /**
     * Sprint 11 / PR-2 — "send email as the user via Gmail" toggle. Off
     * by default until BE-11.x ships the consent + refresh-token plumbing.
     * When false the Gmail UI is hidden even if `google.enabled` is true.
     */
    gmailSend: boolean;
  };
  logging: {
    level: LogLevel;
    enableRemote: boolean;
  };
  attendance: AttendanceScannerConfig;
  /**
   * Firebase web SDK config. Used only by the Storage adapter for
   * LMS files / reports / media. Note: these values are PUBLIC by
   * Firebase's design — the security boundary is the Storage Security
   * Rules + the BE-signed upload token, NOT hiding the config.
   * Leave undefined to disable the Firebase adapter entirely.
   */
  firebase?: FirebaseConfig;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}
