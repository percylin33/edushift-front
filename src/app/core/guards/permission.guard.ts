import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';
import { ROUTES } from '@core/constants';

/**
 * Granular ACL gate. Reads `route.data.permissions` (an array of `Permission`
 * keys) and verifies the current user has at least one of them.
 *
 * Use this for fine-grained access inside a feature (e.g., admin sub-routes).
 * For coarse role-based checks, prefer `roleGuard` from `core/guards`.
 *
 *   {
 *     path: 'students/new',
 *     canActivate: [permissionGuard],
 *     data: { permissions: [Permission.StudentsWrite] },
 *     loadComponent: () => ...
 *   }
 */
export const permissionGuard: CanActivateFn = (route): true | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const required = (route.data?.['permissions'] ?? []) as Permission[];
  if (required.length === 0) return true;

  const owned = auth.user()?.permissions ?? [];
  const granted = required.some((p) => owned.includes(p));
  return granted ? true : router.createUrlTree([ROUTES.ERRORS.FORBIDDEN]);
};
