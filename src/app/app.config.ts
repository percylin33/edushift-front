import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  withRouterConfig,
  withViewTransitions,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { provideCore } from '@core/providers';
import { AppTitleStrategy, SelectivePreloadStrategy } from '@core/routing';

/**
 * Application providers.
 *
 * Router setup:
 *   - `withComponentInputBinding`  → route params auto-bind to `input()` signals.
 *   - `withInMemoryScrolling`      → restore scroll on back/forward, anchor scroll.
 *   - `withRouterConfig({ paramsInheritanceStrategy: 'always' })`
 *                                  → child routes see parent params (essential
 *                                    for nested feature trees).
 *   - `withPreloading(SelectivePreloadStrategy)`
 *                                  → a lazy route is fetched in the background
 *                                    only when it sets `data.preload: true`.
 *                                    Everything else loads on navigation, so
 *                                    the login screen does not pull every
 *                                    feature over a slow network.
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
      withPreloading(SelectivePreloadStrategy),
      withViewTransitions({
        // Browsers abort an in-flight view transition when a newer navigation
        // wins (double-click, rapid route change, back/forward). That surfaces
        // as `AbortError: Transition was skipped` — harmless, not an app bug.
        onViewTransitionCreated: ({ transition }) => {
          const ignoreAbort = (err: unknown): void => {
            if (
              (err instanceof DOMException && err.name === 'AbortError') ||
              (typeof err === 'object' &&
                err !== null &&
                'name' in err &&
                (err as { name: string }).name === 'AbortError')
            ) {
              return;
            }
            console.error(err);
          };
          transition.ready.catch(ignoreAbort);
          transition.finished.catch(ignoreAbort);
          transition.updateCallbackDone.catch(ignoreAbort);
        },
      }),
    ),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    ...provideCore(),
  ],
};
