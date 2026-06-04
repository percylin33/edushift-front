import { UserStatus } from '@core/enums';

/**
 * RAW shape returned by `POST /api/v1/auth/login` and `POST /api/v1/auth/refresh`.
 * Mirrors the backend `AuthResponse` Java record one-to-one.
 *
 * `AuthApiService.login` / `.refresh` adapt this into the project-internal
 * {@link com.edushift.frontend.AuthSession} (computes `expiresAt` from
 * `expiresInSec`), so consumers never see this raw shape.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-5 (OAuth 2.0 §5)
 */
export interface AuthResponseRaw {
  accessToken: string;
  refreshToken: string;
  /** Always `'Bearer'` — present for RFC 6750 conformance, not used by the client. */
  tokenType: 'Bearer' | string;
  /** Access token TTL in seconds. Used to compute `expiresAt`. */
  expiresInSec: number;
  user: UserSummaryRaw;
}

/**
 * RAW backend `UserSummary` record (the 5-field projection returned by
 * login/refresh; the backend deliberately keeps it small to avoid a second
 * round-trip for the dashboard shell).
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
 * Wrapped in {@link com.edushift.frontend.ApiResponse}{@code <UserResponse>}
 * by the controller — consumers should unwrap before using.
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
