import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { HttpStatus } from '@core/enums';
import { ROUTES } from '@core/constants';
import { AuthService, LoggerService, NotificationService } from '@core/services';

/**
 * Centralizes HTTP error handling: logs the error, dispatches user-facing
 * notifications and redirects on auth-related failures. Feature code can
 * still {@code .catchError()} for case-specific handling — the interceptor
 * only handles cross-cutting concerns.
 *
 * <h3>401 strategy</h3>
 * By the time a 401 reaches this interceptor, the upstream
 * {@code tokenRefreshInterceptor} has already had its chance to
 * silently refresh and retry. So a 401 here means one of:
 * <ul>
 *   <li>The refresh token itself is gone or has been rotated/revoked
 *       (the silent-refresh path threw and bubbled the original 401).</li>
 *   <li>The request hit an auth-flow endpoint ({@code /auth/login},
 *       {@code /auth/refresh}, {@code /auth/logout}) which the refresh
 *       interceptor deliberately bypasses — bad credentials and the
 *       like LEGITIMATELY surface as 401 and the calling component
 *       owns how to display them.</li>
 * </ul>
 * In both cases we wipe the local session and bounce the user to
 * {@code /auth/login} carrying the URL they were trying to reach as
 * {@code ?returnUrl=...}. After a successful login the page reads it
 * back and navigates there.
 * <p>
 * We deliberately exclude {@code /auth/login} and {@code /auth/refresh}
 * themselves from the redirect — bouncing the user away from a login
 * form on bad password (or from a refresh attempt on dead session)
 * would hide the actual error.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      logger.error(`HTTP ${error.status} ${req.method} ${req.url}`, error);

      switch (error.status) {
        case HttpStatus.Unauthorized:
          if (!isAuthEndpoint(req.url)) {
            auth.clearSession();
            const returnUrl = stripQueryFromAuthLogin(router.url);
            router.navigate([ROUTES.AUTH.LOGIN], {
              queryParams: returnUrl ? { returnUrl } : undefined
            });
          }
          break;
        case HttpStatus.Forbidden:
          router.navigate([ROUTES.ERRORS.FORBIDDEN]);
          break;
        case HttpStatus.NotFound:
          break;
        case 0:
          notifications.error('No se pudo conectar con el servidor. Verifica tu conexión.');
          break;
        default:
          if (error.status >= HttpStatus.InternalServerError) {
            notifications.error('Ocurrió un error inesperado. Intenta nuevamente.');
          }
      }

      return throwError(() => error);
    })
  );
};

/**
 * `/auth/login` and `/auth/refresh` legitimately answer 401 on bad input —
 * we let those bubble up so the calling component (login form, refresh
 * scheduler) can surface them.
 */
function isAuthEndpoint(url: string): boolean {
  return url.endsWith('/auth/login') || url.endsWith('/auth/refresh');
}

/**
 * If the 401 happened while the user is already on the login page, do not
 * stash the login URL itself as `returnUrl` — that would create an awkward
 * `/auth/login?returnUrl=/auth/login` after they retry and re-fail.
 */
function stripQueryFromAuthLogin(currentUrl: string): string | null {
  const path = currentUrl.split('?')[0];
  if (path === ROUTES.AUTH.LOGIN || path === '' || path === '/') return null;
  return currentUrl;
}
