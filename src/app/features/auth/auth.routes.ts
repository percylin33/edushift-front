import { Routes } from '@angular/router';
import { authChildGuard, guestGuard } from '@core/guards';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  /*
   * Sprint 17 / FE-17.1: forgot/reset password screens. Both are public
   * (no `guestGuard` and no `authGuard`): the user is unauthenticated when
   * they hit these pages, but we also don't want to bounce a signed-in
   * user away — they might have come here from an email link while their
   * session is still alive in another tab.
   */
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  /*
   * Sprint 17 / FE-17.3 — MFA challenge screen. Reached after
   * `/auth/login` returns an MfaRequired response. The bearer
   * sent on this screen's requests is the short-lived `mfaToken`
   * (see `auth.interceptor.ts` precedence). No `guestGuard` —
   * the user already authenticated at the password step; the
   * `mfaToken` itself is the proof.
   */
  {
    path: 'mfa-challenge',
    loadComponent: () =>
      import('./pages/mfa-challenge/mfa-challenge.component').then((m) => m.MfaChallengeComponent),
  },
  /*
   * Sprint 17 / FE-17.3 — MFA enrollment. Reached from the profile
   * page's "Activar MFA" CTA. No `guestGuard` — the user must be
   * logged in to enroll their own account; the auth interceptor
   * sends the bearer automatically.
   */
  {
    path: 'mfa-enroll',
    canActivate: [authChildGuard],
    loadComponent: () =>
      import('./pages/mfa-enroll/mfa-enroll.component').then((m) => m.MfaEnrollComponent),
  },
];
