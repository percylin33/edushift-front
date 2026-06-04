import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { toAuthSession, toUser } from '@core/adapters';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import {
  ApiResponse,
  AuthResponseRaw,
  AuthSession,
  RefreshTokenRequest,
  User,
  UserResponseRaw
} from '@core/models';
import { ForgotPasswordRequest, LoginRequest, ResetPasswordRequest } from '../models';

/**
 * Auth HTTP boundary. No state here — `AuthService` (core) owns the session.
 *
 * <h3>Why we adapt at this layer</h3>
 * The backend speaks the OAuth-flavored {@link AuthResponseRaw} on
 * `/login` / `/refresh` (no envelope, RFC 6749 §5 alignment) and the
 * project-standard {@link ApiResponse}{@code <T>} envelope everywhere
 * else. Mapping that diversity here keeps the rest of the front
 * (components, the {@code AuthService} state, guards) free of ad-hoc
 * unwrapping logic and lets the contract evolve in one place.
 *
 * <h3>What the adapters do</h3>
 * The wire ⇒ UI mapping itself ({@code toAuthSession},
 * {@code toUserSummary}, {@code toUser}) lives in
 * {@code core/adapters/auth-session.adapter.ts} so other features that
 * receive the same {@code AuthResponse} shape ({@code TenantApiService}
 * for self-signup) reuse the exact same logic — see the adapter file
 * for the rationale.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiService);

  /**
   * Verify credentials and obtain an access + refresh pair.
   *
   * <p>The {@code X-Tenant-Slug} header that the backend requires here is
   * attached by {@code tenantInterceptor} based on the resolved tenant —
   * callers pass the credentials only.
   */
  login(payload: LoginRequest): Observable<AuthSession> {
    return this.api.post<AuthResponseRaw>(API.AUTH.LOGIN, payload).pipe(map(toAuthSession));
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
      .pipe(map(toAuthSession));
  }

  /**
   * Fetch the full user behind the current access token. Wrapped in
   * {@link ApiResponse}{@code <UserResponseRaw>} by the backend; we
   * unwrap here so consumers always work with a plain {@link User}.
   */
  me(): Observable<User> {
    return this.api
      .get<ApiResponse<UserResponseRaw>>(API.AUTH.ME)
      .pipe(map((envelope) => toUser(envelope.data)));
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<void> {
    return this.api.post<void>(API.AUTH.FORGOT_PASSWORD, payload);
  }

  resetPassword(payload: ResetPasswordRequest): Observable<void> {
    return this.api.post<void>(API.AUTH.RESET_PASSWORD, payload);
  }
}
