import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';

/**
 * Usage in routes:
 *
 *   {
 *     path: 'admin',
 *     canActivate: [roleGuard],
 *     data: { roles: [UserRole.TenantAdmin, UserRole.SuperAdmin] },
 *     loadChildren: () => ...
 *   }
 */
export const roleGuard: CanActivateFn = (route): true | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowed = (route.data?.['roles'] ?? []) as UserRole[];
  if (allowed.length === 0) return true;

  return auth.hasRole(...allowed) ? true : router.createUrlTree([ROUTES.ERRORS.FORBIDDEN]);
};
