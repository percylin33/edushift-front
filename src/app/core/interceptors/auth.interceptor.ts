import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService } from '@core/services';

/** Attach `Authorization: Bearer <accessToken>` to outbound requests to our API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();

  if (!token) return next(req);
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const headerName = environment.auth.tokenHeaderName;
  const scheme = environment.auth.tokenScheme;
  const value = scheme ? `${scheme} ${token}` : token;

  return next(req.clone({ setHeaders: { [headerName]: value } }));
};
