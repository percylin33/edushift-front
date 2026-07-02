import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';
import { ROUTES } from '@core/constants';

/**
 * Shape of the `data` payload a route declares to gate on permissions.
 *
 * <p>{@link permissions} accepts either a single {@link Permission} or an
 * array. The optional {@link permissionMode} switches the matching
 * semantics: {@code 'any'} (default) is inclusive-OR, {@code 'all'} is
 * conjunction (the user must hold every listed authority).
 *
 * <p>Mirrors the shape consumed by {@link HasPermissionDirective} so the
 * two halves of the FE RBAC story stay symmetric.
 */
export interface PermissionRouteData {
  permissions?: Permission | Permission[];
  permissionMode?: 'any' | 'all';
  [key: string]: unknown;
}

/**
 * Granular ACL gate. Reads `route.data.permissions` (a `Permission` or
 * an array of them) and verifies the current user satisfies the predicate.
 * Empty/missing `permissions` is a no-op and lets the route through — pair
 * it with {@code roleGuard} or {@code authGuard} for coarse checks.
 *
 * <h3>Why {@code CanMatchFn} (and not just {@code CanActivate})</h3>
 * A {@code CanMatchFn} runs **before** the lazy chunk is fetched. A
 * STUDENT who hits {@code /lms/tasks/new} never downloads the
 * {@code tasks.routes} bundle — the router matches the route to a
 * fall-through, and {@code permissionGuard} redirects to {@code /403}
 * without burning bandwidth. {@code CanActivate} still works (and is
 * retained as a no-op for backward compatibility with existing route
 * tables that wire it under `canActivate:`), but new LMS routes should
 * prefer {@code canMatch: [permissionGuard]}.
 *
 * <h3>Usage</h3>
 * <pre>
 *   {
 *     path: 'grade',
 *     canMatch: [permissionGuard],
 *     data: { permissions: Permission.LmsTaskGrade },
 *     loadComponent: () => ...
 *   }
 * </pre>
 *
 * For routes that need both a role and a permission (e.g. only TEACHER
 * with the LMS grading authority), declare both guards — Angular invokes
 * them in array order and the first failure short-circuits.
 */
export const permissionGuard: CanMatchFn = (
  _route: Route,
  _segments: UrlSegment[],
): true | UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  /* `CanMatchFn` doesn't receive the data object directly, so we read it
   * off the route the matcher was built from. Both signatures converge on
   * the same `data` shape thanks to the `PermissionRouteData` typing. */
  const data = (_route.data ?? {}) as PermissionRouteData;
  const required = data.permissions
    ? Array.isArray(data.permissions)
      ? data.permissions
      : [data.permissions]
    : [];
  if (required.length === 0) return true;

  const owned = auth.permissions();
  const mode = data.permissionMode ?? 'any';
  const granted =
    mode === 'all'
      ? required.every((p) => owned.includes(p))
      : required.some((p) => owned.includes(p));

  return granted ? true : router.createUrlTree([ROUTES.ERRORS.FORBIDDEN]);
};
