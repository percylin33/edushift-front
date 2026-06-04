import { UserStatus } from '@core/enums';

/**
 * RAW shape returned by every backend endpoint that issues a session
 * (`POST /v1/auth/login`, `POST /v1/auth/refresh`, and as of Sprint 2
 * also `POST /v1/tenants/register`). Mirrors the backend `AuthResponse`
 * Java record one-to-one (RFC 6749 §5 alignment, no envelope).
 *
 * <p>Lives in {@code core/models} on purpose: more than one feature
 * (auth + tenants/self-signup) needs to consume this contract, and we
 * don't want feature-to-feature imports just to share a wire DTO.
 *
 * <p>Adapted into the project-internal {@link AuthSession} by
 * {@link toAuthSession} (see {@code core/adapters}); consumers should
 * not work with the raw shape directly.
 */
export interface AuthResponseRaw {
  accessToken: string;
  refreshToken: string;
  /** Always `'Bearer'` — present for RFC 6750 conformance, not used by the client. */
  tokenType: 'Bearer' | string;
  /** Access token TTL in seconds. Used to compute the session's `expiresAt`. */
  expiresInSec: number;
  user: UserSummaryRaw;
}

/**
 * RAW backend `UserSummary` record (the 5-field projection returned by
 * login/refresh/register; the backend deliberately keeps it small to
 * avoid a second round-trip for the dashboard shell).
 */
export interface UserSummaryRaw {
  publicUuid: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
}

/**
 * RAW backend `UserResponse` record (full user, returned by `GET /auth/me`).
 *
 * <p>Wrapped in {@code ApiResponse<UserResponseRaw>} by the controller —
 * consumers should unwrap before using.
 */
export interface UserResponseRaw {
  publicUuid: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Body sent on `POST /auth/refresh` and `POST /auth/logout`. */
export interface RefreshTokenRequest {
  refreshToken: string;
}
