import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
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
    // Google Cloud Console → APIs & Services → Credentials. Make sure
    // "Authorized JavaScript origins" includes http://localhost:4200
    // (and the dev tunnel URL used for mobile testing).
    clientId: 'REPLACE_ME_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com',
    scopes: [
      'openid',
      'profile',
      'email',
      // PR-2 adds the gmail.send scope here.
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
    // LMS (Sprint 7a). Off by default in production until BE-7a.0..5 are
    // signed off; flipped on in dev to allow exercising the new tree.
    lms: true,
    // PR-2 (gmail send) is still in flight; keep disabled in dev too
    // until BE-11.x lands the refresh-token storage.
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
  firebase: {
    // EduShift dedicated Firebase project. Web config is PUBLIC by design —
    // the security boundary is the BE-signed upload URLs + Storage
    // Security Rules (deferred to post-migration).
    // The values below are placeholders for the dev project; replace via
    // environment.local.ts (gitignored) once Firebase Console provisions
    // them. See docs/infra/firebase.md.
    apiKey: 'REPLACE_ME_WITH_FIREBASE_WEB_API_KEY',
    authDomain: 'project-1ecb3cb0-5e49-49b2-8e5.firebaseapp.com',
    projectId: 'project-1ecb3cb0-5e49-49b2-8e5',
    storageBucket: 'project-1ecb3cb0-5e49-49b2-8e5.appspot.com',
    messagingSenderId: 'REPLACE_ME_WITH_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'REPLACE_ME_WITH_FIREBASE_WEB_APP_ID',
  },
};
