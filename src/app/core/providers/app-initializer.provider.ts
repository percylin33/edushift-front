import { APP_INITIALIZER, Provider, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService, LoggerService, TenantService } from '@core/services';
import { APP } from '@core/constants';
import { AuthApiService } from '@features/auth/services/auth-api.service';

/**
 * Bootstrap-time work that must finish before the router activates the
 * first route. Order of side effects matters; the steps below are
 * idempotent and ordered by dependency.
 *
 * <ol>
 *   <li><strong>Resolve tenant.</strong> Reads the slug from URL /
 *       subdomain / storage / config (see {@code TenantService}) and
 *       publishes it so the {@code tenantInterceptor} can attach
 *       {@code X-Tenant-Slug} on the very first request.</li>
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
 *       The call is best-effort: any failure is logged and swallowed
 *       so a transient network blip doesn't keep the app stuck on a
 *       blank page. Subsequent guards / requests will surface the
 *       real auth state.</li>
 *
 *   <li><strong>Boot log.</strong> Single line that gets surfaced in
 *       support sessions ("what version + tenant did the user have?").</li>
 * </ol>
 */
function appInitializerFactory(): () => Promise<void> {
  return async () => {
    const tenantService = inject(TenantService);
    const auth = inject(AuthService);
    const authApi = inject(AuthApiService);
    const logger = inject(LoggerService);

    const { slug, resolvedFrom } = tenantService.resolveSlug();
    tenantService.setTenant(
      { id: slug, slug, name: slug, isActive: true },
      resolvedFrom
    );

    if (auth.accessToken()) {
      try {
        const user = await firstValueFrom(authApi.me());
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
