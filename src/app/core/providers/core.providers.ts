import {
  EnvironmentProviders,
  Provider,
  importProvidersFrom,
  makeEnvironmentProviders,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  GoogleLoginProvider,
  SocialAuthServiceConfig,
  SocialLoginModule,
} from '@abacritt/angularx-social-login';
import { HTTP_INTERCEPTORS_CHAIN } from '@core/interceptors';
import { environment } from '@env/environment';
import { APP_INITIALIZER_PROVIDER } from './app-initializer.provider';

/**
 * One-stop provider for everything `core` needs. Add it to `app.config.ts`.
 * Keep it lean — only cross-cutting infra goes here.
 */
export function provideCore(): (Provider | EnvironmentProviders)[] {
  const googleEnabled = environment.google.enabled && !!environment.google.clientId;

  return [
    provideHttpClient(withFetch(), withInterceptors(HTTP_INTERCEPTORS_CHAIN)),
    APP_INITIALIZER_PROVIDER,
    // angularx-social-login needs the Angular animations provider even
    // though our UI doesn't use them directly — the library attaches an
    // overlay for the popup lifecycle.
    provideAnimations(),
    // Conditional Google wiring. If the env doesn't have a Client ID we
    // skip the whole module so the library never tries to initialize
    // against a placeholder.
    googleEnabled
      ? importProvidersFrom(SocialLoginModule.initialize(buildGoogleConfig()))
      : makeEnvironmentProviders([]),
  ];
}

function buildGoogleConfig(): SocialAuthServiceConfig {
  return {
    autoLogin: false,
    providers: [
      {
        id: 'google',
        provider: new GoogleLoginProvider(environment.google.clientId, {
          scopes: [...environment.google.scopes],
          // One-tap UX is opt-in per Google's policy; we keep the popup
          // flow because EduShift is multi-tenant and One Tap doesn't
          // expose the tenant context to the BE in a clean way.
          oneTapEnabled: false,
        }),
      },
    ],
    onError: (err) => {
      // Log only — the consuming component decides how to surface errors.
      console.warn('[google-auth] provider error', err);
    },
  };
}
