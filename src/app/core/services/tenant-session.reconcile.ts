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
 * Browser back/forward (and bfcache) can restore an in-memory tenant from
 * school A while localStorage still holds school B's session — or boot from
 * {@code ?tenant=} for school A while a prior JWT for school B survives.
 * Authenticated surfaces must paint branding from {@code GET /tenants/me}.
 * On {@code /auth/login?tenant=X} with a foreign session, drop the session
 * so the login form shows X without leaking B's data under X's chrome.
 */
export async function reconcileTenantWithSession(
  deps: TenantSessionReconcileDeps,
  source: string,
): Promise<void> {
  const { tenantService, tenantApi, auth, authApi, logger } = deps;
  const urlSlug = readTenantQuerySlug();
  const onLoginRoute = isAuthLoginPath(typeof location !== 'undefined' ? location.pathname : '');

  // SECURITY FIX: Tokens are in httpOnly cookies, check isAuthenticated instead
  if (!auth.isAuthenticated()) {
    if (urlSlug && tenantService.tenantSlug() !== urlSlug) {
      try {
        const tenant = await firstValueFrom(
          tenantApi.findBySlug(urlSlug).pipe(timeout(RECONCILE_HTTP_TIMEOUT_MS)),
        );
        tenantService.setTenant(tenant, 'path');
      } catch (err) {
        logger.warn(`reconcile(${source}): failed to hydrate ?tenant=${urlSlug}`, err);
      }
    }
    return;
  }

  try {
    const user = await firstValueFrom(authApi.me().pipe(timeout(RECONCILE_HTTP_TIMEOUT_MS)));
    auth.setUser(user);
  } catch (err) {
    logger.warn(`reconcile(${source}): failed to rehydrate /auth/me`, err);
  }

  let sessionTenant;
  try {
    sessionTenant = await firstValueFrom(
      tenantApi.findCurrent().pipe(timeout(RECONCILE_HTTP_TIMEOUT_MS)),
    );
  } catch (err) {
    logger.warn(`reconcile(${source}): failed to load /tenants/me`, err);
    return;
  }

  if (onLoginRoute && urlSlug && urlSlug !== sessionTenant.slug) {
    auth.clearSession();
    try {
      const loginTenant = await firstValueFrom(
        tenantApi.findBySlug(urlSlug).pipe(timeout(RECONCILE_HTTP_TIMEOUT_MS)),
      );
      tenantService.setTenant(loginTenant, 'path');
    } catch (err) {
      logger.warn(`reconcile(${source}): failed to hydrate login tenant ${urlSlug}`, err);
      tenantService.setTenant(sessionTenant, 'header');
    }
    return;
  }

  tenantService.setTenant(sessionTenant, 'header');
}

function readTenantQuerySlug(): string | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('tenant');
    const trimmed = raw?.trim().toLowerCase();
    return trimmed && /^[a-z0-9][a-z0-9-]{0,62}$/i.test(trimmed) ? trimmed : null;
  } catch {
    return null;
  }
}

function isAuthLoginPath(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  return path === '/auth/login' || path.endsWith('/auth/login');
}
