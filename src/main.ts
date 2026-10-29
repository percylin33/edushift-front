import {
  importProvidersFrom,
  mergeApplicationConfig,
  type ApplicationConfig,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from '@env/environment';

/**
 * Bootstrap strategy.
 *
 * EduShift ships with Google Sign-In DISABLED in production. The
 * `@abacritt/angularx-social-login` SDK is heavy (~16 KB gzipped) and
 * registers {@code SocialAuthServiceConfig} at module-load, so its chunk
 * is not requested unless the integration is enabled.
 *
 * The social-login SDK and its animation provider stay in optional chunks.
 * They are loaded only when the selected environment has a real Google OAuth
 * client ID and explicitly enables the integration.
 */

async function bootstrap(): Promise<void> {
  const googleProviders = await resolveGoogleProviders();
  const config: ApplicationConfig = googleProviders.length
    ? mergeApplicationConfig(appConfig, { providers: googleProviders })
    : appConfig;
  await bootstrapApplication(AppComponent, config);
}

async function resolveGoogleProviders(): Promise<(Provider | EnvironmentProviders)[]> {
  if (!environment.google.enabled || !environment.google.clientId) return [];

  const [social, animations] = await Promise.all([
    import('@abacritt/angularx-social-login'),
    import('@angular/platform-browser/animations'),
  ]);
  return [
    ...animations.provideAnimations(),
    importProvidersFrom(
      social.SocialLoginModule.initialize({
        autoLogin: false,
        providers: [
          {
            id: 'google',
            provider: new social.GoogleLoginProvider(environment.google.clientId, {
              scopes: [...environment.google.scopes],
              oneTapEnabled: false,
            }),
          },
        ],
        onError: (err: unknown) => console.warn('[google-auth] provider error', err),
      }),
    ),
  ];
}

bootstrap().catch((err) => console.error(err));
