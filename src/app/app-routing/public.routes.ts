import { Routes } from '@angular/router';
import { AuthLayoutComponent, OnboardingLayoutComponent } from '@layout/index';
import { featureFlagGuard } from '@core/guards';
import { FeatureKey } from '@core/enums';

/**
 * Routes that don't require an authenticated session (plus auth shell
 * pages that do, e.g. MFA enroll / CRED-7 first-login).
 *
 * Two distinct shells:
 *   - `AuthLayoutComponent`       → login / forgot / reset / first-login
 *   - `OnboardingLayoutComponent` → multi-step wizard (header + stepper + card)
 *
 * Per-route {@code guestGuard} keeps login/register free of signed-in noise;
 * authenticated-only auth pages declare {@code authChildGuard} themselves.
 */
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'auth',
        canActivate: [featureFlagGuard],
        data: { feature: FeatureKey.Auth, title: 'Acceso' },
        loadChildren: () => import('@features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
      },
      /*
       * Invitation accept page lives under the auth shell because it
       * is a logged-out flow that produces a session. It deliberately
       * does NOT use {@link guestGuard}: an admin who clicks an
       * invitation link for a different tenant should still be able
       * to redeem it (the backend will rotate the session into the
       * invitation's tenant). The featureFlagGuard is also dropped —
       * the only way to reach this page is via a token-bearing URL
       * shared by an admin, so gating it behind a SPA-side flag would
       * just create dead links that don't even render the error copy.
       */
      {
        path: 'invitation/:token',
        data: { title: 'Activar cuenta' },
        loadComponent: () =>
          import('@features/users/pages/invitation-accept/invitation-accept.component').then(
            (m) => m.InvitationAcceptComponent,
          ),
      },
    ],
  },
  {
    path: 'onboarding',
    component: OnboardingLayoutComponent,
    data: { title: 'Onboarding' },
    loadChildren: () =>
      import('@features/onboarding/onboarding.routes').then((m) => m.ONBOARDING_ROUTES),
  },
];
