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
  const url = `${environment.apiUrl}/${environment.apiVersion}/${path}`;
  return next(req.clone({ url }));
};
