import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@env/environment';

/**
 * Rewrites relative URLs that start with `api/` to the absolute API base URL.
 * Lets features call `apiService.get('api/users')` without knowing the host.
 */
export const apiUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (/^https?:\/\//i.test(req.url)) return next(req);

  const normalized = req.url.replace(/^\/+/, '');
  if (!normalized.startsWith('api/')) return next(req);

  const path = normalized.replace(/^api\//, '');
  // Features such as family/me call `/api/v1/...`. This interceptor already
  // injects `apiVersion`, so a leftover `v1/` in the path produced
  // `/api/v1/v1/family/children` (ENDPOINT_NOT_FOUND).
  const versionPrefix = `${environment.apiVersion}/`;
  const stripped = path.startsWith(versionPrefix) ? path.slice(versionPrefix.length) : path;
  const url = `${environment.apiUrl}/${environment.apiVersion}/${stripped}`;
  return next(req.clone({ url }));
};
