import { Permission, UserRole, UserStatus } from '@core/enums';
import {
  AuthResponseRaw,
  AuthSession,
  User,
  UserResponseRaw,
  UserSummary,
  UserSummaryRaw,
} from '@core/models';
import { AdminLoginResponseRaw } from '@features/admin/models/admin-login-response.model';

/**
 * Wire ⇒ UI adapters for the shared `AuthResponse` / `UserResponse`
 * shapes. Pure functions on purpose — no DI, no rxjs — so any layer
 * (feature service, guard, test) can call them directly.
 *
 * <h3>Why these live in `core/adapters`</h3>
 * Both {@code AuthApiService} (login + refresh) and
 * {@code TenantApiService} (self-signup) hand back an
 * {@link AuthSession}. Sharing the adapter here keeps the
 * "raw → session" mapping in one place and lets future endpoints
 * (e.g. SSO callback) plug in without a feature-to-feature import.
 */

/**
 * Build an {@link AuthSession} from the raw backend response.
 *
 * <p>The {@code expiresAt} is computed as
 * {@code Date.now() + expiresInSec * 1000} so the rest of the app
 * (silent-refresh scheduler, interceptors) can decide proactively when
 * to rotate without parsing the JWT.
 */
export function toAuthSession(raw: AuthResponseRaw): AuthSession {
  return {
    user: toUserSummary(raw.user),
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    expiresAt: new Date(Date.now() + raw.expiresInSec * 1000),
  };
}

/**
 * Build an {@link AuthSession} from the SUPER_ADMIN wire shape returned
 * by `POST /v1/admin/login`.
 *
 * <p>The admin endpoint returns a slightly richer `user` (firstName +
 * lastName + a flat roles array) but skips the concatenated
 * {@code fullName}. This adapter:</p>
 * <ol>
 *   <li>Computes {@code expiresAt = Date.now() + expiresInSec * 1000}
 *       so the silent-refresh scheduler can use the same primitive as
 *       the regular login flow. Without this step the consumer would
 *       build {@code new Date(undefined)} and crash on
 *       {@code Date.toISOString()} inside {@code AuthService.setSession}.</li>
 *   <li>Concatenates firstName + lastName into a {@code fullName} the
 *       rest of the app can display (sidebar avatar tooltip, header menu).</li>
 *   <li>Promotes the raw roles string[] into a typed {@link UserRole}[]
 *       via {@link toRoles} so {@code AuthService.hasRole} resolves
 *       correctly and the {@code roleGuard([SuperAdmin])} gate of the
 *       admin console lets the SUPER_ADMIN through. Skipping this step
 *       would persist a session with {@code roles = undefined} and
 *       silently fall through to the regular workspace layout.</li>
 *   <li>Builds the user payload as the richer {@link User} shape
 *       (which extends {@link UserSummary}) so the rest of the app —
 *       which casts to {@code User} inside {@code setSession} — has
 *       the authorization data it needs.</li>
 * </ol>
 */
export function toAdminAuthSession(raw: AdminLoginResponseRaw): AuthSession {
  const fullName = raw.user.fullName?.trim()
    || [raw.user.firstName, raw.user.lastName].filter(Boolean).join(' ').trim()
    || raw.user.email;

  const adminUser: User = {
    publicUuid: raw.user.publicUuid,
    fullName,
    email: raw.user.email,
    // The admin endpoint enforces ACTIVE in the service layer
    // (AdminAuthService.login — see `if (user.getStatus() != ACTIVE)`),
    // so any session that reaches this adapter is by definition active.
    // We hard-code the enum value rather than threading it through the
    // wire because the admin login response intentionally omits `status`
    // — the contract is "if you got a 200, the user is ACTIVE".
    status: UserStatus.Active,
    firstName: raw.user.firstName,
    lastName: raw.user.lastName,
    roles: toRoles(raw.user.roles),
    permissions: [],
  };

  return {
    user: adminUser,
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    expiresAt: new Date(Date.now() + raw.expiresInSec * 1000),
  };
}

/**
 * Adapt the raw five-field projection into the project-internal
 * {@link UserSummary}. Normalizes Jackson's {@code null} (empty-optional
 * convention) into TypeScript-friendly {@code undefined}.
 */
export function toUserSummary(raw: UserSummaryRaw): UserSummary {
  return {
    publicUuid: raw.publicUuid,
    fullName: raw.fullName,
    email: raw.email,
    avatarUrl: raw.avatarUrl ?? undefined,
    status: raw.status,
  };
}

/**
 * Adapt the rich `GET /auth/me` payload to the {@link User} domain
 * model. Same {@code null → undefined} normalization as above.
 */
export function toUser(raw: UserResponseRaw): User {
  return {
    publicUuid: raw.publicUuid,
    fullName: raw.fullName,
    email: raw.email,
    avatarUrl: raw.avatarUrl ?? undefined,
    status: raw.status,
    firstName: raw.firstName ?? undefined,
    lastName: raw.lastName ?? undefined,
    phone: raw.phone ?? undefined,
    emailVerified: raw.emailVerified,
    mfaEnabled: raw.mfaEnabled,
    roles: toRoles(raw.roles),
    permissions: toPermissions(raw.permissions),
    lastLoginAt: raw.lastLoginAt ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined,
  };
}

/**
 * Narrow the backend's {@code String[]} role payload to the typed
 * {@link UserRole} enum, dropping anything the frontend doesn't know
 * about (forward-compat: a backend role added before the SPA is
 * redeployed should not crash the navigation guards).
 */
export function toRoles(raw: string[] | null | undefined): UserRole[] {
  if (!raw || raw.length === 0) return [];
  const known = new Set<string>(Object.values(UserRole));
  return raw.filter((r): r is UserRole => known.has(r));
}

/**
 * Narrow the backend's {@code String[]} authorities payload to the typed
 * {@link Permission} enum. Symmetric to {@link toRoles}: unknown authority
 * strings (e.g. a future `LMS_AI_TUTOR_USE` the SPA hasn't been redeployed
 * to learn) are silently dropped, keeping `*hasPermission` and
 * `permissionGuard` fail-closed.
 */
export function toPermissions(raw: string[] | null | undefined): Permission[] {
  if (!raw || raw.length === 0) return [];
  const known = new Set<string>(Object.values(Permission));
  return raw.filter((p): p is Permission => known.has(p));
}
