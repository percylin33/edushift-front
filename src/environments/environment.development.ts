import type { AppEnvironment } from './environment.model';
import { runtimeOverrides } from './runtime-overrides';

export const environment: AppEnvironment = runtimeOverrides({
  production: false,
  uatMode: true,
  appName: 'EduShift',
  appVersion: '0.0.0-dev',
  apiUrl: 'http://localhost:8080/api',
  apiVersion: 'v1',
  defaultLocale: 'es',
  supportedLocales: ['es', 'en'],
  multiTenant: {
    enabled: true,
    strategy: 'subdomain',
    headerName: 'X-Tenant-Slug',
    // Platform fallback for non-auth surfaces. Auth login itself requires a
    // URL identity: http://localhost:4200/auth/login?tenant=tecnosur
    defaultTenant: 'demo',
  },
  auth: {
    tokenStorageKey: 'edushift.auth.token',
    refreshTokenStorageKey: 'edushift.auth.refreshToken',
    tokenHeaderName: 'Authorization',
    tokenScheme: 'Bearer',
    withCredentials: true,
  },
  google: {
    enabled: false,
    // Google sign-in is disabled for this deployment.
    clientId: 'REPLACE_ME_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com',
    scopes: [
      'openid',
      'profile',
      'email',
      // PR-2 adds the gmail.send scope here.
    ],
  },
  // Keep dev MFA enrollment interactive so the user can scan the QR code.
  // Set a bypass code only when deliberately exercising the dev-only flow.
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
    // Feature routes enabled for development.
    lms: true,
    // FIX BUG-2026-07-30-09 / -10 / -18 / -19: routes were registered
    // with `featureFlagGuard` but the corresponding feature flags were
    // never declared in this env, so the guard fell back to `false` and
    // redirected to /404. Add them here so /announcements, /schedule,
    // /family and /me are reachable in dev.
    announcements: true,
    schedule: true,
    family: true,
    disclosures: true,
    admissions: true,
    me: true,
    // Enable all feature routes; Google sign-in remains disabled above.
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
  firebase: {
    // EduShift dedicated Firebase project. Web config is PUBLIC by design —
    // the security boundary is the BE-signed upload URLs + Storage
    // Security Rules (deferred to post-migration).
    // The values below are placeholders for the dev project; replace via
    // environment.local.ts (gitignored) once Firebase Console provisions
    // them. See docs/infra/firebase.md.
    apiKey: 'AIzaSyAnWp4Xcy6QqFzGkGNzSB7WXw0yYIRpj6U',
    authDomain: 'edushift-f03db.firebaseapp.com',
    projectId: 'edushift-f03db',
    storageBucket: 'edushift-f03db.firebasestorage.app',
    messagingSenderId: '390884898100',
    appId: '1:390884898100:web:9fe332355e52403587e161',
    messagingVapidKey: 'BBit7vIdDVzI2ph9gx8Ggpi6E5UwNRuu45jEUC3tu1a25gDaR71xBv9vDfAm8-TCCeV87tAgwHQuWCqsjN8EdC4',
  },
});
