import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { AuthService, LoggerService } from '@core/services';
import { Permission, UserRole } from '@core/enums';
import { ROUTES } from '@core/constants';
import { AuthApiService } from '@features/auth/services/auth-api.service';

/** Hard ceiling for the guard's "wait for /auth/me" path, in ms. */
const GUARD_ME_TIMEOUT_MS = 5_000;

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
  /** Re-fetch the current user's effective permissions before matching this route. */
  refreshPermissions?: boolean;
  /** Optional coarse roles accepted in addition to any listed permission. */
  roles?: UserRole[];
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
 * <h3>Self-healing: waits for {@code /auth/me} (DEBT-QA-FE-4)</h3>
 * The login response only carries a {@code UserSummary} (5 fields, no
 * {@code permissions}); the full {@code User} is fetched from
 * {@code GET /auth/me}. The {@code APP_INITIALIZER} does that at boot, but
 * the very first navigation can race the boot-time fetch (and any direct
 * route visit — bookmark, deep link, hard reload) sees an empty
 * {@code permissions()} signal. Without this guard's self-healing step,
 * the user would be bounced to {@code /403} for any permission-gated route
 * they should actually be allowed into.
 *
 * <p>If we have an access token but {@code permissions()} is empty and the
 * route requires permissions, we synchronously call {@code /auth/me} and
 * re-evaluate. Same best-effort + 5 s timeout as the initializer; on
 * failure we fall through to the standard {@code /403} redirect (the
 * unauthenticated path of {@code errorInterceptor} will log the user out
 * if the token is dead).
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
export const permissionGuard: CanMatchFn = async (
  _route: Route,
  _segments: UrlSegment[],
): Promise<true | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const authApi = inject(AuthApiService);
  const logger = inject(LoggerService);

  /* `CanMatchFn` doesn't receive the data object directly, so we read it
   * off the route the matcher was built from. Both signatures converge on
   * the same `data` shape thanks to the `PermissionRouteData` typing. */
  const data = (_route.data ?? {}) as PermissionRouteData;
  const allowedRoles = data.roles ?? [];
  if (allowedRoles.length > 0 && auth.hasRole(...allowedRoles)) return true;
  const required = data.permissions
    ? Array.isArray(data.permissions)
      ? data.permissions
      : [data.permissions]
    : [];
  if (required.length === 0) return true;

  /* DEBT-QA-FE-4: if we have a session but `permissions()` is empty,
   * the boot-time `/auth/me` either hasn't run yet or failed. Self-heal
   * by firing it here (one-shot: the call result lands in AuthService
   * so subsequent guard evaluations are synchronous-fast). Skip the
   * self-heal when there is no session at all — `authChildGuard` and
   * the error interceptor will redirect to /auth/login. */
  const mustRefreshPermissions =
    auth.isAuthenticated() && (data.refreshPermissions === true || auth.permissions().length === 0);
  if (mustRefreshPermissions) {
    try {
      const user = await firstValueFrom(authApi.me().pipe(timeout(GUARD_ME_TIMEOUT_MS)));
      auth.setUser(user);
    } catch (err) {
      logger.warn('permissionGuard: self-healing /auth/me failed; deferring to /403.', err);
      if (data.refreshPermissions === true) {
        return router.createUrlTree([ROUTES.ERRORS.FORBIDDEN]);
      }
    }
  }

  const owned = auth.permissions();
  const mode = data.permissionMode ?? 'any';
  const granted =
    mode === 'all'
      ? required.every((p) => owned.includes(p))
      : required.some((p) => owned.includes(p));

  return granted ? true : router.createUrlTree([ROUTES.ERRORS.FORBIDDEN]);
};
