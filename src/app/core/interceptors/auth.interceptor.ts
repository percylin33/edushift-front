import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '@core/services';

/**
 * Attach `Authorization: Bearer <token>` to outbound requests to our API.
 *
 * <h3>Token precedence</h3>
 * <ol>
 *   <li><b>accessToken</b> (normal authenticated session) — preferred.</li>
 *   <li><b>mfaToken</b> (Sprint 17 / BE-17.2) — used during the MFA
 *       challenge window when no full session is established yet.
 *       The BE recognizes this short-lived token and uses it to
 *       validate the {@code /auth/mfa/challenge} call without ever
 *       minting a full session.</li>
 * </ol>
 *
 * <p>The mfaToken takes over only when there is no accessToken
 * (otherwise the user is fully signed in and any subsequent
 * MFA-related call is on behalf of the existing session, not the
 * challenge flow).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken() ?? auth.mfaToken();
  if (!token) return next(req);
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const headerName = environment.auth.tokenHeaderName;
  const scheme = environment.auth.tokenScheme;
  const value = scheme ? `${scheme} ${token}` : token;

  return next(req.clone({ setHeaders: { [headerName]: value } }));
};
