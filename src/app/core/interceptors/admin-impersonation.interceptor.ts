import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@env/environment';
import { AdminImpersonationService } from '@features/admin/services/admin-impersonation.service';

/** Marks support-mode calls so auth recovery never replaces the impersonation cookie with the admin session. */
export const adminImpersonationInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  const impersonation = inject(AdminImpersonationService);
  if (!impersonation.active()) return next(req);
  return next(req.clone({ setHeaders: { 'X-Admin-Impersonation': '1' }, withCredentials: true }));
};
