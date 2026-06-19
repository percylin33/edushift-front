import { Permission, UserRole, UserStatus } from '@core/enums';

/**
 * Minimal user projection returned by `/auth/login` and `/auth/refresh`
 * (mirrors the backend `UserSummary` record, see `auth.md` §2.1 / §4.2).
 *
 * The five fields here are guaranteed to be present after a successful
 * login — enough to render the sidebar, the user menu and the dashboard
 * shell without an extra `/me` round-trip. Anything richer (firstName,
 * roles, audit timestamps) lives on the {@link User} interface and is
 * fetched on demand via `AuthApiService.me()`.
 */
export interface UserSummary {
  publicUuid: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  status: UserStatus;
}

/**
 * Full user payload returned by `GET /auth/me` (backend `UserResponse`).
 *
 * Extends {@link UserSummary} so a `UserSummary` is structurally assignable
 * wherever a `User` is expected; that lets the auth state hold a single
 * `_user` signal and progressively enrich it (post-login → post-`/me`)
 * without callers having to discriminate the two shapes.
 *
 * `roles` and `permissions` will start being emitted once Sprint 2 wires
 * RBAC; in Sprint 1 they default to empty arrays at the consumer level.
 * `tenantId` mirrors the JWT `tenant_id` claim and is convenient for
 * client-side scope checks but is not required because the backend always
 * re-validates server-side.
 */
export interface User extends UserSummary {
  firstName?: string;
  lastName?: string;
  phone?: string;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;

  /** RBAC. Populated by the backend on every `/auth/me` (Sprint 2) and from
   *  granular authority mappers in Sprint 7a (BE-7a.3 — LMS authorities). */
  roles?: UserRole[];
  permissions?: Permission[];

  /** Convenience copy of the JWT `tenant_id` claim. */
  tenantId?: string;
}

/**
 * In-memory session held by {@link com.edushift.frontend.AuthService}.
 *
 * Built by adapting the backend `AuthResponse` in {@code AuthApiService}:
 * `expiresAt` is computed as `Date.now() + expiresInSec * 1000` so the
 * UI can schedule silent refreshes without parsing the JWT.
 */
export interface AuthSession {
  user: UserSummary;
  accessToken: string;
  refreshToken: string;
  /** Absolute expiration of the access token (computed client-side from `expiresInSec`). */
  expiresAt: Date;
}
