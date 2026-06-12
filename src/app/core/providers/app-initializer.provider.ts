import { APP_INITIALIZER, Provider, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { AuthService, LoggerService, TenantService } from '@core/services';
import { APP } from '@core/constants';
import { TenantStatus } from '@core/enums';
import { AuthApiService } from '@features/auth/services/auth-api.service';
import { TenantApiService } from '@features/tenants';

/** Hard ceiling for tenant + user rehydration at boot, in milliseconds. */
const BOOT_HTTP_TIMEOUT_MS = 5000;

/**
 * Bootstrap-time work that must finish before the router activates the
 * first route. Order of side effects matters; the steps below are
 * idempotent and ordered by dependency.
 *
 * <ol>
 *   <li><strong>Resolve tenant slug.</strong> Reads the slug from URL /
 *       subdomain / storage / config (see {@code TenantService}) and
 *       <em>immediately</em> seeds an optimistic placeholder so the
 *       {@code tenantInterceptor} can attach {@code X-Tenant-Slug} on
 *       the very first outgoing request — including the bootstrap
 *       fetch in step 2.</li>
 *
 *   <li><strong>Hydrate the tenant from the backend (FE-2.4).</strong>
 *       Calls {@code GET /v1/tenants/by-slug/{slug}} to replace the
 *       placeholder with the authoritative {@code TenantSummary}: real
 *       name, branding (primary color, logo, favicon) and lifecycle
 *       status. {@code TenantService.setTenant} re-applies the theme
 *       and the favicon as a side effect, so the login screen paints
 *       in the tenant's brand on first render rather than the platform
 *       default.
 *       <br><br>
 *       The call is best-effort and timeboxed at
 *       {@value #BOOT_HTTP_TIMEOUT_MS} ms: if the backend is unreachable
 *       (offline mode, dev backend not running) we keep the placeholder
 *       and let the rest of the app boot. The slug we resolved is
 *       enough for {@code AuthService.login} to send the right header.</li>
 *
 *   <li><strong>Rehydrate the user (if a session is in storage).</strong>
 *       The login response only carries a {@link UserSummary} (display
 *       name, avatar, status); the full {@link User} — roles,
 *       permissions, mfaEnabled, last login, etc. — is fetched on
 *       demand from {@code GET /auth/me}. Doing it here means:
 *       <ul>
 *         <li>Roles/permissions are available before the first
 *             {@code roleGuard} / {@code permissionGuard} fires, avoiding
 *             a redirect-loop on a protected first route.</li>
 *         <li>If the access token expired while the tab was closed,
 *             {@code tokenRefreshInterceptor} silently rotates and the
 *             user keeps their session. If the refresh token is also
 *             dead, {@code errorInterceptor} bounces to login —
 *             intentional and correct.</li>
 *       </ul>
 *       Same best-effort + timeout treatment as the tenant fetch above.</li>
 *
 *   <li><strong>Boot log.</strong> Single line that gets surfaced in
 *       support sessions ("what version + tenant did the user have?").</li>
 * </ol>
 *
 * <h3>Why both fetches are best-effort</h3>
 * Boot must finish — a dead backend should not keep the app on a blank
 * screen. The placeholder tenant + missing-user state are coherent: the
 * router sends the user to {@code /auth/login}, which queues network
 * activity and surfaces real errors via the standard error interceptor
 * once the user actually tries to do something.
 */
function appInitializerFactory(): () => Promise<void> {
  return async () => {
    const tenantService = inject(TenantService);
    const tenantApi = inject(TenantApiService);
    const auth = inject(AuthService);
    const authApi = inject(AuthApiService);
    const logger = inject(LoggerService);

    const { slug, resolvedFrom } = tenantService.resolveSlug();
    /* Optimistic placeholder so theme / interceptors have a tenant id
     * during the bootstrap fetch below. {@code status: ACTIVE} keeps
     * existing guards permissive while the real DTO is in flight.
     *
     * IMPORTANT: do NOT persist the placeholder — only the authoritative
     * tenant returned by {@code findBySlug} below should land in storage.
     * Persisting the placeholder is what caused the "stale tunnel id"
     * bug: when {@code resolveSlug} fell back to a bogus value (e.g. the
     * devtunnel host's first label), the failed hydration would still
     * leave that value cached for every subsequent boot. */
    tenantService.setTenant(
      { id: slug, slug, name: slug, status: TenantStatus.Active, isActive: true },
      resolvedFrom,
      { persist: false }
    );

    /* FE-2.4 — hydrate the tenant from the public `by-slug` endpoint.
     * Public on the backend (no bearer required), so we can call it
     * even when no session is in storage. */
    try {
      const tenant = await firstValueFrom(
        tenantApi.findBySlug(slug).pipe(timeout(BOOT_HTTP_TIMEOUT_MS))
      );
      tenantService.setTenant(tenant, resolvedFrom);
    } catch (err) {
      logger.warn(
        `Failed to hydrate tenant '${slug}' at boot; keeping the placeholder.`,
        err
      );
    }

    if (auth.accessToken()) {
      try {
        const user = await firstValueFrom(authApi.me().pipe(timeout(BOOT_HTTP_TIMEOUT_MS)));
        auth.setUser(user);
      } catch (err) {
        logger.warn('Failed to rehydrate user at boot; deferring to guards.', err);
      }
    }

    logger.info(`${APP.NAME} v${APP.VERSION} booted (tenant=${slug}, resolved=${resolvedFrom})`);
  };
}

export const APP_INITIALIZER_PROVIDER: Provider = {
  provide: APP_INITIALIZER,
  useFactory: appInitializerFactory,
  multi: true
};
