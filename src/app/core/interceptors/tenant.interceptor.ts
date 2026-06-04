import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env/environment';
import { API } from '@core/constants';
import { TenantService } from '@core/services';

/**
 * Attach the current tenant slug to outbound requests that need it.
 *
 * <h3>Why only on `/auth/login`</h3>
 * The Sprint 1 backend resolves the tenant per endpoint (see
 * `docs/modules/auth.md` §5.1):
 * <ul>
 *   <li>`/auth/login` — header {@code X-Tenant-Slug} is the ONLY signal,
 *       because the user does not yet have a token to derive scope from.</li>
 *   <li>`/auth/refresh`, `/auth/logout` — the tenant is read from the
 *       {@code tenant_id} claim inside the refresh JWT.</li>
 *   <li>Every other authenticated endpoint — the tenant comes from the
 *       access JWT via {@code JwtAuthenticatedPrincipal}.</li>
 * </ul>
 * Sending the header globally is harmless on the backend (it is ignored
 * outside `/auth/login`), but doing so leaks the resolved tenant to log
 * scrapers and complicates request signing if we ever add it. Restricting
 * the header to where it is actually consumed keeps the surface tight.
 *
 * <h3>Slug vs id</h3>
 * The header is named {@code X-Tenant-Slug} (see backend constant
 * {@code AuthController.TENANT_SLUG_HEADER}). We forward the resolved
 * {@code tenantSlug()}; the {@code tenantId()} fallback only matters
 * once the back is migrated to id-based lookup, which is not the case
 * in Sprint 1.
 */
export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.multiTenant.enabled) return next(req);
  if (req.url !== API.AUTH.LOGIN) return next(req);

  const tenantService = inject(TenantService);
  const tenantSlug = tenantService.tenantSlug() ?? environment.multiTenant.defaultTenant;
  if (!tenantSlug) return next(req);

  return next(req.clone({ setHeaders: { [environment.multiTenant.headerName]: tenantSlug } }));
};
