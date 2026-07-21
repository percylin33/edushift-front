import {
  EnvironmentProviders,
  Provider,
  importProvidersFrom,
  makeEnvironmentProviders,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS_CHAIN } from '@core/interceptors';
import { environment } from '@env/environment';
import { APP_INITIALIZER_PROVIDER } from './app-initializer.provider';

/**
 * One-stop provider for everything `core` needs. Add it to `app.config.ts`.
 * Keep it lean — only cross-cutting infra goes here.
 *
 * Google Sign-In wiring is split out into `provideGoogleCore()` so that
 * the `@abacritt/angularx-social-login` SDK — which registers
 * `SocialAuthServiceConfig` at module load — never enters the production
 * bundle unless `environment.google.enabled` is true. Tree-shaking cannot
 * remove a module referenced via a static `import`, so the SDK is loaded
 * via a dynamic `import()` inside `provideGoogleCore()`.
 */
export function provideCore(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withFetch(), withInterceptors(HTTP_INTERCEPTORS_CHAIN)),
    APP_INITIALIZER_PROVIDER,
    // angularx-social-login needs the Angular animations provider even
    // though our UI doesn't use them directly — the library attaches an
    // overlay for the popup lifecycle.
    provideAnimations(),
  ];
}

/**
 * Async provider that wires Google Sign-In only when the feature flag is on.
 *
 * The promise resolves to either an `EnvironmentProviders` (Google enabled)
 * or `makeEnvironmentProviders([])` (Google disabled). esbuild tree-shakes
 * the dynamic import target away when this module is never reachable.
 */
export function provideGoogleCore(): Promise<EnvironmentProviders> {
  if (!environment.google.enabled || !environment.google.clientId) {
    return Promise.resolve(makeEnvironmentProviders([]));
  }
  // Dynamic import: only fetched when google.enabled is true. esbuild keeps
  // the chunk isolated so prod builds without Google never download it.
  return import('@abacritt/angularx-social-login').then((social) => {
    const config = {
      autoLogin: false,
      providers: [
        {
          id: 'google',
          provider: new social.GoogleLoginProvider(environment.google.clientId, {
            scopes: [...environment.google.scopes],
            // One-tap UX is opt-in per Google's policy; we keep the popup
            // flow because EduShift is multi-tenant and One Tap doesn't
            // expose the tenant context to the BE in a clean way.
            oneTapEnabled: false,
          }),
        },
      ],
      onError: (err: unknown) => {
        console.warn('[google-auth] provider error', err);
      },
    };
    return importProvidersFrom(social.SocialLoginModule.initialize(config));
  });
}
