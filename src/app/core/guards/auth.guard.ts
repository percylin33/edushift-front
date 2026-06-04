import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';

const checkAuth = (returnUrl: string): true | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree([ROUTES.AUTH.LOGIN], {
    queryParams: returnUrl ? { returnUrl } : undefined
  });
};

export const authGuard: CanActivateFn = (_route, state) => checkAuth(state.url);

export const authChildGuard: CanActivateChildFn = (_route, state) => checkAuth(state.url);
