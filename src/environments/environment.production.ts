import type { AppEnvironment } from './environment.model';
import { runtimeOverrides } from './runtime-overrides';

export const environment: AppEnvironment = runtimeOverrides({
  production: true,
  uatMode: false,
  appName: 'EduShift',
  appVersion: '0.0.0',
  apiUrl: 'https://edushift-back.onrender.com/api',
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
    tokenScheme: 'Bearer',
    withCredentials: true
  },
  google: {
    // Disable by default in production until the operator supplies a
    // real Client ID and registers the prod origin in Google Console.
    enabled: false,
    clientId: '',
    scopes: ['openid', 'profile', 'email']
  },
  // Dev-only MFA enrolment bypass is intentionally NOT defined in
  // production. Leaving the field undefined means the FE will surface
  // a clear "MFA enrolment required" error instead of attempting an
  // auto-bypass against an endpoint that does not exist in prod.
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
    // Feature routes enabled for this deployment.
    lms: true,
    // FIX BUG-2026-07-30-09 / -10 / -18 / -19: type parity with the
    // shared AppEnvironment shape. Toggle per deployment as needed;
    // announcements/schedule/family/me ship behind featureFlagGuard.
    announcements: true,
    schedule: true,
    family: true,
    disclosures: true,
    admissions: true,
    me: true,
    gmailSend: true
  },
  logging: {
    level: 'warn',
    enableRemote: true
  },
  attendance: {
    scannerEngine: 'zxing-ngx',
    scanCooldownMs: 1200,
    feedbackDismissMs: 1200,
    offlineBannerCopy: 'Sin conexión. Vuelve a conectarte para escanear.',
    pwaDisplay: 'standalone',
    pwaStartUrl: '/attendance/scanner'
  },
  // Firebase Web configuration for the current EduShift test project.
  // These client values and the VAPID public key are published in the FE bundle;
  // keep the Admin SDK private key exclusively in the backend environment.
  firebase: {
    apiKey: 'AIzaSyAnWp4Xcy6QqFzGkGNzSB7WXw0yYIRpj6U',
    authDomain: 'edushift-f03db.firebaseapp.com',
    projectId: 'edushift-f03db',
    storageBucket: 'edushift-f03db.firebasestorage.app',
    messagingSenderId: '390884898100',
    appId: '1:390884898100:web:9fe332355e52403587e161',
    messagingVapidKey:
      'BBit7vIdDVzI2ph9gx8Ggpi6E5UwNRuu45jEUC3tu1a25gDaR71xBv9vDfAm8-TCCeV87tAgwHQuWCqsjN8EdC4',
  },
});
