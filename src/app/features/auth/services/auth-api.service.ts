import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { ApiResponse, AuthSession, User, UserSummary } from '@core/models';
import {
  AuthResponseRaw,
  ForgotPasswordRequest,
  LoginRequest,
  RefreshTokenRequest,
  ResetPasswordRequest,
  UserResponseRaw,
  UserSummaryRaw
} from '../models';

/**
 * Auth HTTP boundary. No state here — `AuthService` (core) owns the session.
 *
 * <h3>Why we adapt at this layer</h3>
 * The backend speaks the OAuth-flavored {@link AuthResponseRaw} on
 * `/login` / `/refresh` (no envelope, RFC 6749 §5 alignment) and the
 * project-standard {@link ApiResponse}`<T>` envelope everywhere else.
 * Mapping that diversity here keeps the rest of the front (components,
 * the `AuthService` state, guards) free of ad-hoc unwrapping logic and
 * lets the contract evolve in one place.
 *
 * <h3>What the adapters do</h3>
 * <ul>
 *   <li>{@link #toSession} — computes `expiresAt = now + expiresInSec * 1000`
 *       so consumers can schedule silent refreshes without parsing the JWT.
 *   </li>
 *   <li>{@link #toUserSummary} / {@link #toUser} — normalize {@code null}
 *       (Jackson's empty-optional convention) into {@code undefined}, which
 *       is what TypeScript ergonomics expect.</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiService);

  /**
   * Verify credentials and obtain an access + refresh pair.
   *
   * The {@code X-Tenant-Slug} header that the backend requires here is
   * attached by {@code tenantInterceptor} based on the resolved tenant —
   * callers pass the credentials only.
   */
  login(payload: LoginRequest): Observable<AuthSession> {
    return this.api
      .post<AuthResponseRaw>(API.AUTH.LOGIN, payload)
      .pipe(map((raw) => this.toSession(raw)));
  }

  /**
   * Revoke the refresh token server-side. Idempotent on the backend (a
   * malformed / unknown / already-revoked token still returns 204), but
   * it requires the token in the body — Sprint 1 does not enforce bearer
   * auth on this endpoint precisely so a client whose access token has
   * expired can still log out.
   */
  logout(refreshToken: string): Observable<void> {
    const body: RefreshTokenRequest = { refreshToken };
    return this.api.post<void, RefreshTokenRequest>(API.AUTH.LOGOUT, body);
  }

  /** Rotate the refresh token. Replaying an already-rotated token poisons the chain (theft detection). */
  refresh(refreshToken: string): Observable<AuthSession> {
    const body: RefreshTokenRequest = { refreshToken };
    return this.api
      .post<AuthResponseRaw, RefreshTokenRequest>(API.AUTH.REFRESH, body)
      .pipe(map((raw) => this.toSession(raw)));
  }

  /**
   * Fetch the full user behind the current access token. Wrapped in
   * {@link ApiResponse}`<UserResponseRaw>` by the backend; we unwrap here
   * so consumers always work with a plain `User`.
   */
  me(): Observable<User> {
    return this.api
      .get<ApiResponse<UserResponseRaw>>(API.AUTH.ME)
      .pipe(map((envelope) => this.toUser(envelope.data)));
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<void> {
    return this.api.post<void>(API.AUTH.FORGOT_PASSWORD, payload);
  }

  resetPassword(payload: ResetPasswordRequest): Observable<void> {
    return this.api.post<void>(API.AUTH.RESET_PASSWORD, payload);
  }

  // ---------------------------------------------------------------------------
  // Adapters (raw backend shapes → project-internal models)
  // ---------------------------------------------------------------------------

  private toSession(raw: AuthResponseRaw): AuthSession {
    const expiresAt = new Date(Date.now() + raw.expiresInSec * 1000);
    return {
      user: this.toUserSummary(raw.user),
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
      expiresAt
    };
  }

  private toUserSummary(raw: UserSummaryRaw): UserSummary {
    return {
      publicUuid: raw.publicUuid,
      fullName: raw.fullName,
      email: raw.email,
      avatarUrl: raw.avatarUrl ?? undefined,
      status: raw.status
    };
  }

  private toUser(raw: UserResponseRaw): User {
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
      lastLoginAt: raw.lastLoginAt ?? undefined,
      createdAt: raw.createdAt ?? undefined,
      updatedAt: raw.updatedAt ?? undefined
    };
  }
}
