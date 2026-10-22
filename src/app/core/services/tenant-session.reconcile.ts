import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { TenantService } from './tenant.service';
import { AuthApiService } from '@features/auth/services/auth-api.service';
import { TenantApiService } from '@features/tenants';

const RECONCILE_HTTP_TIMEOUT_MS = 5000;

export interface TenantSessionReconcileDeps {
  tenantService: TenantService;
  tenantApi: TenantApiService;
  auth: AuthService;
  authApi: AuthApiService;
  logger: LoggerService;
}

/**
 * Keep school branding aligned with the authenticated JWT session.
 *
 * Authenticated surfaces must paint branding from {@code GET /tenants/me}.
 * If the session belongs to a different school than the current hostname,
 * drop it and keep the hostname-selected tenant to avoid cross-school chrome.
 */
export async function reconcileTenantWithSession(
  deps: TenantSessionReconcileDeps,
  source: string,
): Promise<void> {
  const { tenantService, tenantApi, auth, authApi, logger } = deps;
  const requestedTenant = tenantService.tenant();
  const hasTenantHost = tenantService.hasTenantHost();

  // SECURITY FIX: Tokens are in httpOnly cookies, check isAuthenticated instead
  if (!auth.isAuthenticated()) return;

  try {
    const user = await firstValueFrom(authApi.me().pipe(timeout(RECONCILE_HTTP_TIMEOUT_MS)));
    auth.setUser(user);
  } catch (err) {
    logger.warn(`reconcile(${source}): failed to rehydrate /auth/me`, err);
  }

  // Platform surfaces (for example, Super Admin) can run on the bare local
  // host. They need /auth/me, but must not infer a school from the session.
  if (!hasTenantHost) return;

  let sessionTenant;
  try {
    sessionTenant = await firstValueFrom(
      tenantApi.findCurrent().pipe(timeout(RECONCILE_HTTP_TIMEOUT_MS)),
    );
  } catch (err) {
    logger.warn(`reconcile(${source}): failed to load /tenants/me`, err);
    return;
  }

  if (requestedTenant && requestedTenant.slug !== sessionTenant.slug) {
    auth.clearSession();
    tenantService.setTenant(requestedTenant, 'subdomain');
    return;
  }

  tenantService.setTenant(sessionTenant, 'header');
}
