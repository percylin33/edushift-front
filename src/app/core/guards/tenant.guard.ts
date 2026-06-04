import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { TenantService } from '@core/services';
import { ROUTES } from '@core/constants';

/** Ensure a tenant context is resolved before entering tenant-scoped routes. */
export const tenantGuard: CanActivateFn = (): true | UrlTree => {
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (tenantService.tenantSlug()) return true;

  return router.createUrlTree([ROUTES.ERRORS.NOT_FOUND]);
};
