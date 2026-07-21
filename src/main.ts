import { bootstrapApplication, type ApplicationConfig } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/**
 * Bootstrap strategy.
 *
 * EduShift ships with Google Sign-In DISABLED in production. The
 * `@abacritt/angularx-social-login` SDK is heavy (~16 KB gzipped) and
 * registers {@code SocialAuthServiceConfig} at module-load, so we keep
 * it out of the production bundle entirely.
 *
 * To re-enable Google Sign-In:
 *
 *   1. Provision an OAuth Client ID in Google Cloud Console.
 *   2. Update environment.production.ts (google.enabled = true,
 *      google.clientId = "<your-client-id>").
 *   3. Replace this file's contents with the dynamic-import version
 *      (see git history) — the import comment block is intentionally
 *      kept below so the re-enable is one diff.
 *
 * If you want a single bundle that serves both modes, that requires
 * conditional imports at build-time using a file replacement; see the
 * Angular CLI docs on `fileReplacements` + `define`. EduShift uses the
 * simpler "two configs, two builds" approach.
 */

async function bootstrap(): Promise<void> {
  await bootstrapApplication(AppComponent, appConfig);
}

bootstrap().catch((err) => console.error(err));

/* eslint-disable @typescript-eslint/no-unused-vars, max-len */
// RE-ENABLE: when Google is needed, replace the entire file with:
//
//   import { bootstrapApplication, type ApplicationConfig } from '@angular/platform-browser';
//   import { EnvironmentProviders, importProvidersFrom, mergeApplicationConfig } from '@angular/core';
//   import { appConfig } from './app/app.config';
//   import { AppComponent } from './app/app.component';
//   import { environment } from '@env/environment';
//
//   async function bootstrap(): Promise<void> {
//     const googleProviders = await resolveGoogleProviders();
//     const finalConfig: ApplicationConfig = googleProviders
//       ? mergeApplicationConfig(appConfig, { providers: [googleProviders] })
//       : appConfig;
//     await bootstrapApplication(AppComponent, finalConfig);
//   }
//
//   async function resolveGoogleProviders(): Promise<EnvironmentProviders | null> {
//     if (!environment.google.enabled || !environment.google.clientId) return null;
//     const social = await import('@abacritt/angularx-social-login');
//     return importProvidersFrom(
//       social.SocialLoginModule.initialize({
//         autoLogin: false,
//         providers: [{
//           id: 'google',
//           provider: new social.GoogleLoginProvider(environment.google.clientId, {
//             scopes: [...environment.google.scopes],
//             oneTapEnabled: false,
//           }),
//         }],
//         onError: (err: unknown) => console.warn('[google-auth] provider error', err),
//       }),
//     );
//   }
//
//   bootstrap().catch((err) => console.error(err));
