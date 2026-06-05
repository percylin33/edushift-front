import { UserRole } from '@core/enums';
import { AuthResponseRaw, AuthSession, User, UserResponseRaw, UserSummary, UserSummaryRaw } from '@core/models';

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
    expiresAt: new Date(Date.now() + raw.expiresInSec * 1000)
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
    status: raw.status
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
    lastLoginAt: raw.lastLoginAt ?? undefined,
    createdAt: raw.createdAt ?? undefined,
    updatedAt: raw.updatedAt ?? undefined
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
