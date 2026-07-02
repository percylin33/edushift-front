import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { HttpStatus } from '@core/enums';
import { API } from '@core/constants';
import { AuthService } from '@core/services';
import { TokenRefreshService } from '@features/auth/services/token-refresh.service';

/**
 * Reactive (single-flight) silent-refresh interceptor.
 *
 * <h3>Position in the chain</h3>
 * Sits as the <strong>last</strong> entry in
 * {@code HTTP_INTERCEPTORS_CHAIN} — i.e. closest to the backend in
 * Angular's functional-interceptor model. That guarantees its
 * {@code catchError} sees the 401 <em>before</em>
 * {@code errorInterceptor} (which would otherwise clear the session
 * and redirect). On a successful refresh+retry the response flows
 * upward as a normal 200 and the error branch never fires; on a
 * failed refresh, this interceptor re-throws the original 401 and
 * lets {@code errorInterceptor} handle the bounce-to-login. The
 * full ordering rationale lives in {@code core/interceptors/index.ts}.
 *
 * <h3>When it acts</h3>
 * Only on:
 * <ul>
 *   <li>HTTP {@code 401}</li>
 *   <li>Outbound URLs targeting our API ({@code environment.apiUrl})
 *       — we don't shadow third-party 401s.</li>
 *   <li>Endpoints that aren't part of the auth flow itself
 *       ({@code /auth/login}, {@code /auth/refresh}, {@code /auth/logout}) —
 *       a 401 there is a legitimate business error, not a stale token.</li>
 *   <li>The user actually holds a refresh token. Without it, the next
 *       interceptor ({@code errorInterceptor}) handles the bounce-to-login.</li>
 * </ul>
 *
 * <h3>Mechanics</h3>
 * <ol>
 *   <li>Catch a 401, ask {@link TokenRefreshService#refresh} for a fresh
 *       access token. The service guarantees only one refresh round-trip
 *       runs concurrently across the whole app.</li>
 *   <li>Re-issue the original {@link import('@angular/common/http').HttpRequest}
 *       with the new token. We re-clone with {@code setHeaders} so the
 *       authorization header is replaced (not appended). The request is
 *       handed back to {@code next} — note that, in Angular's interceptor
 *       chain, this <em>only</em> walks the remaining interceptors, so
 *       {@code authInterceptor} does not run again. That's why we set
 *       the Authorization header explicitly here.</li>
 *   <li>If the refresh itself fails (refresh token expired/revoked),
 *       {@link TokenRefreshService} has already cleared the session — we
 *       just rethrow the original 401 so {@code errorInterceptor}
 *       performs the standard login redirect.</li>
 * </ol>
 *
 * <h3>What it explicitly does NOT do</h3>
 * <ul>
 *   <li><strong>Proactive scheduling.</strong> A timer-based refresh
 *       (fire {@code N} seconds before {@code expiresAt}) is more
 *       fragile (suspend on hidden tabs, drift on slow systems) and
 *       only helps in the narrow window where the user is idle but the
 *       token still expires. The reactive flow handles every realistic
 *       case (active user, returning from a closed laptop, etc.) with
 *       a single 401-reroundtrip cost — acceptable.</li>
 *   <li><strong>Retry of non-401 failures.</strong> Each request gets at
 *       most one retry, and only when the cause is a stale access
 *       token. Real 401s from the auth endpoints, business 4xx, and
 *       network errors all bubble up untouched.</li>
 * </ul>
 */
export const tokenRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  if (isAuthFlowEndpoint(req.url)) return next(req);

  const auth = inject(AuthService);
  const refresher = inject(TokenRefreshService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== HttpStatus.Unauthorized) {
        return throwError(() => error);
      }
      if (!auth.refreshToken()) {
        return throwError(() => error);
      }

      return refresher.refresh().pipe(
        switchMap((newAccessToken) => next(applyAuthHeader(req, newAccessToken))),
        catchError(() => throwError(() => error)),
      );
    }),
  );
};

/**
 * Endpoints whose 401 we leave alone — the auth feature itself owns
 * how to surface bad credentials, expired refresh, etc.
 */
function isAuthFlowEndpoint(url: string): boolean {
  return url === API.AUTH.LOGIN || url === API.AUTH.REFRESH || url === API.AUTH.LOGOUT;
}

/**
 * Replace (not append) the configured authorization header on the
 * retry. We mirror {@code authInterceptor} so the header naming and
 * scheme stay configured in a single place ({@code environment.auth}).
 */
function applyAuthHeader(
  req: import('@angular/common/http').HttpRequest<unknown>,
  accessToken: string,
) {
  const headerName = environment.auth.tokenHeaderName;
  const scheme = environment.auth.tokenScheme;
  const value = scheme ? `${scheme} ${accessToken}` : accessToken;
  return req.clone({ setHeaders: { [headerName]: value } });
}
