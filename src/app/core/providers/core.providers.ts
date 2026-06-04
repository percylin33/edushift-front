import { EnvironmentProviders, Provider, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { HTTP_INTERCEPTORS_CHAIN } from '@core/interceptors';
import { APP_INITIALIZER_PROVIDER } from './app-initializer.provider';

/**
 * One-stop provider for everything `core` needs. Add it to `app.config.ts`.
 * Keep it lean — only cross-cutting infra goes here.
 */
export function provideCore(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(withFetch(), withInterceptors(HTTP_INTERCEPTORS_CHAIN)),
    APP_INITIALIZER_PROVIDER,
    makeEnvironmentProviders([])
  ];
}
