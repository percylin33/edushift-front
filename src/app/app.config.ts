import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  PreloadAllModules,
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  withRouterConfig,
  withViewTransitions
} from '@angular/router';

import { routes } from './app.routes';
import { provideCore } from '@core/providers';
import { AppTitleStrategy } from '@core/routing';

/**
 * Application providers.
 *
 * Router setup:
 *   - `withComponentInputBinding`  → route params auto-bind to `input()` signals.
 *   - `withInMemoryScrolling`      → restore scroll on back/forward, anchor scroll.
 *   - `withRouterConfig({ paramsInheritanceStrategy: 'always' })`
 *                                  → child routes see parent params (essential
 *                                    for nested feature trees).
 *   - `withPreloading(PreloadAllModules)`
 *                                  → after the initial bundle is rendered the
 *                                    router fetches every lazy chunk in the
 *                                    background. Bundles are tiny here
 *                                    (~500–700 B each gzipped) so preloading
 *                                    pays off and removes the "first click on
 *                                    a module is slow" experience.
 *   - `withViewTransitions`        → uses the View Transitions API when the
 *                                    browser supports it for cross-route fade
 *                                    animations. Gracefully no-op elsewhere.
 *   - `TitleStrategy: AppTitleStrategy`
 *                                  → drives `document.title` from `route.data`.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withPreloading(PreloadAllModules),
      withViewTransitions()
    ),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    ...provideCore()
  ]
};
