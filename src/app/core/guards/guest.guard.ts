import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';

/** Prevent already-authenticated users from accessing public-only screens (login, register, etc.). */
export const guestGuard: CanActivateFn = (): true | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree([ROUTES.DASHBOARD.ROOT]) : true;
};
