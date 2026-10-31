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

  if (!auth.isAuthenticated()) {
    return router.createUrlTree([ROUTES.AUTH.LOGIN], {
      queryParams: schoolLoginQueryParams(tenant, { returnUrl: returnUrl || null }),
    });
  }

  // CRED-7 — block the app until the user changes a temporary password.
  if (auth.user()?.mustChangePassword && !returnUrl.startsWith(ROUTES.AUTH.FIRST_LOGIN)) {
    return router.createUrlTree([ROUTES.AUTH.FIRST_LOGIN], {
      queryParams: { returnUrl: returnUrl || null },
    });
  }

  return true;
};

export const authGuard: CanActivateFn = (_route, state) => checkAuth(state.url);

export const authChildGuard: CanActivateChildFn = (_route, state) => checkAuth(state.url);
