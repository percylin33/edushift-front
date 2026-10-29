import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@env/environment';

/**
 * Tokens live in httpOnly cookies. Cross-origin calls (SPA on :4201, API on
 * :8080) only attach those cookies when the request sets
 * {@code withCredentials}. Fetch's default is {@code same-origin}, so a raw
 * {@code HttpClient} call omits the access cookie, the API answers 401, and
 * the refresh retry — which clones that same request — stays anonymous and
 * the session is cleared.
 *
 * Downstream interceptors, including the silent-refresh retry, see this
 * cloned request and keep the flag.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl) || req.withCredentials) {
    return next(req);
  }
  return next(req.clone({ withCredentials: true }));
};
