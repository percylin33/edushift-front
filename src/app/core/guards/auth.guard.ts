import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { schoolLoginQueryParams } from '@core/navigation/school-login.navigation';
import { TenantService } from '@core/services/tenant.service';

const checkAuth = (returnUrl: string): true | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const tenant = inject(TenantService);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree([ROUTES.AUTH.LOGIN], {
    queryParams: schoolLoginQueryParams(tenant, { returnUrl: returnUrl || null }),
  });
};

export const authGuard: CanActivateFn = (_route, state) => checkAuth(state.url);

export const authChildGuard: CanActivateChildFn = (_route, state) => checkAuth(state.url);
