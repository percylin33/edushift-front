import { Routes } from '@angular/router';
import { AuthLayoutComponent, OnboardingLayoutComponent } from '@layout/index';
import { featureFlagGuard, guestGuard } from '@core/guards';
import { FeatureKey } from '@core/enums';

/**
 * Routes that don't require an authenticated session.
 *
 * Two distinct shells:
 *   - `AuthLayoutComponent`       → login / forgot / reset (two-pane branding)
 *   - `OnboardingLayoutComponent` → multi-step wizard (header + stepper + card)
 *
 * Both apply `guestGuard` so already-signed-in users are redirected away,
 * keeping the public area noise-free for authenticated sessions.
 */
export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      {
        path: 'auth',
        canActivate: [guestGuard, featureFlagGuard],
        data: { feature: FeatureKey.Auth, title: 'Acceso' },
        loadChildren: () => import('@features/auth/auth.routes').then((m) => m.AUTH_ROUTES)
      }
    ]
  },
  {
    path: 'onboarding',
    component: OnboardingLayoutComponent,
    data: { title: 'Onboarding' },
    loadChildren: () =>
      import('@features/onboarding/onboarding.routes').then((m) => m.ONBOARDING_ROUTES)
  }
];
