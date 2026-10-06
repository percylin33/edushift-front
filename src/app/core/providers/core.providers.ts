import {
  ENVIRONMENT_INITIALIZER,
  EnvironmentProviders,
  Provider,
  importProvidersFrom,
  inject,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS_CHAIN } from '@core/interceptors';
import { AuthService, LoggerService, TenantService } from '@core/services';
import { reconcileTenantWithSession } from '@core/services/tenant-session.reconcile';
import { AuthApiService } from '@features/auth/services/auth-api.service';
import { TenantApiService } from '@features/tenants';
import { APP_INITIALIZER_PROVIDER } from './app-initializer.provider';

/**
 * Cross-cutting providers shared by every environment. Keep this list
 * lean — only infra that has no tenant-specific configuration goes here.
 *
 * Google Sign-In wiring has been intentionally removed from this file
 * because the `@abacritt/angularx-social-login` SDK registers
 * `SocialAuthServiceConfig` at module-load and any static reference
 * to it forces the SDK into the production bundle, even when the
 * feature is disabled. To re-enable Google, see `main.ts` for the
 * dynamic-import pattern documented inline.
 */
export function provideCore(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withFetch(), withInterceptors(HTTP_INTERCEPTORS_CHAIN)),
    APP_INITIALIZER_PROVIDER,
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        if (typeof window === 'undefined') return;
        const deps = {
          tenantService: inject(TenantService),
          tenantApi: inject(TenantApiService),
          auth: inject(AuthService),
          authApi: inject(AuthApiService),
          logger: inject(LoggerService),
        };
        let inflight: Promise<void> | null = null;
        const run = (source: string) => {
          if (inflight) return;
          inflight = reconcileTenantWithSession(deps, source).finally(() => {
            inflight = null;
          });
        };
        window.addEventListener('pageshow', (e) => {
          if ((e as PageTransitionEvent).persisted) run('bfcache-pageshow');
        });
        window.addEventListener('popstate', () => {
          try {
            const urlSlug =
              new URLSearchParams(window.location.search).get('tenant')?.trim().toLowerCase() ||
              null;
            const mem = deps.tenantService.tenantSlug();
            if (urlSlug && mem && urlSlug !== mem) {
              run('popstate-url-mismatch');
            }
          } catch {
            /* ignore */
          }
        });
      },
    },
    // The social-login SDK requires the Angular animations provider
    // even when the host application does not use animations directly.
    // It's cheap to ship in production; no runtime cost unless a
    // Google popup is opened.
    provideAnimations(),
  ];
}

/**
 * Re-export of {@link importProvidersFrom} for ergonomic use from
 * bootstrap glue. Removed the dynamic-import helper that used to
 * live here; the SDK is now loaded exclusively from `main.ts` so the
 * providers file stays free of any reference to it.
 */
export { importProvidersFrom };
