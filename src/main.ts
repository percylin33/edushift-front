import { bootstrapApplication } from '@angular/platform-browser';
import { mergeApplicationConfig, EnvironmentProviders } from '@angular/core';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from '@env/environment';

/**
 * Bootstrap strategy:
 *
 * - When Google Sign-In is disabled (production default), we boot
 *   straight away with the base `appConfig`. The `@abacritt/angularx-social-login`
 *   SDK is never imported, so its `SocialAuthServiceConfig` provider
 *   never enters the runtime graph, and esbuild tree-shakes the dynamic
 *   chunk entirely out of the bundle.
 *
 * - When Google Sign-In is enabled, we lazy-load `provideGoogleCore()`
 *   via a dynamic `import()` so the SDK only ships to clients that
 *   actually need it. esbuild will create a separate chunk for it;
 *   the chunk is only fetched when this `import()` is reached.
 */
async function bootstrap(): Promise<void> {
  if (!environment.google.enabled || !environment.google.clientId) {
    await bootstrapApplication(AppComponent, appConfig);
    return;
  }
  const { provideGoogleCore } = await import('./app/core/providers/core.providers');
  const googleProviders: EnvironmentProviders = await provideGoogleCore();
  await bootstrapApplication(AppComponent, mergeApplicationConfig(appConfig, { providers: [googleProviders] }));
}

bootstrap().catch((err) => console.error(err));
