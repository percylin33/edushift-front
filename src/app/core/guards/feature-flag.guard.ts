import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { environment } from '@env/environment';
import { FeatureKey } from '@core/enums';
import { ROUTES } from '@core/constants';

/**
 * Blocks navigation when a feature is disabled at the environment level
 * (and, in the future, at the tenant plan level).
 *
 * Usage in routes:
 *
 *   {
 *     path: 'payments',
 *     canActivate: [featureFlagGuard],
 *     data: { feature: FeatureKey.Payments },
 *     loadChildren: () => ...
 *   }
 */
export const featureFlagGuard: CanActivateFn = (route): true | UrlTree => {
  const router = inject(Router);
  const featureKey = route.data?.['feature'] as FeatureKey | undefined;
  if (!featureKey) return true;

  const flags = environment.features as Record<string, boolean>;
  const enabled = flags[featureKey] ?? false;
  return enabled ? true : router.createUrlTree([ROUTES.ERRORS.NOT_FOUND]);
};
