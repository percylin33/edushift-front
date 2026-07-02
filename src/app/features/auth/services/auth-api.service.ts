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
  UserResponseRaw,
} from '@core/models';
import {
  ForgotPasswordRequest,
  GoogleLoginRequest,
  LoginRequest,
  LoginResult,
  MfaChallengeRequest,
  MfaDisableRequest,
  MfaEnrollVerifyRequest,
  MfaEnrollVerifyResponse,
  MfaEnrollmentStart,
  MfaRegenerateRequest,
  MfaRequiredResponse,
  ResetPasswordRequest,
  ResetPasswordValidateResponse,
} from '../models';

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
  /**
   * Verify credentials. Returns a {@link LoginResult} so the caller
   * can pattern-match on whether the user is fully logged in
   * ({@link LoginResultSession}) or still has to complete the
   * MFA challenge ({@link LoginResultMfaRequired}).
   *
   * <p>The discriminator is the presence of a {@code mfaToken} on
   * the raw response. The BE sends the same JSON shape either way;
   * the field {@code mfaToken} is {@code null} for non-MFA users
   * and present otherwise.
   */
  login(payload: LoginRequest): Observable<LoginResult> {
    return this.api
      .post<AuthResponseRaw & { mfaToken?: string | null; expiresInSec?: number }>(
        API.AUTH.LOGIN,
        payload,
      )
      .pipe(
        map((raw) => {
          if (raw.mfaToken) {
            const mfa: MfaRequiredResponse = {
              mfaToken: raw.mfaToken,
              expiresInSec: raw.expiresInSec ?? 300,
              tokenType: raw.tokenType ?? 'Bearer',
            };
            return { kind: 'mfa-required' as const, mfa };
          }
          return { kind: 'session' as const, session: toAuthSession(raw) };
        }),
      );
  }

  /**
   * Trade a Google `id_token` for an EduShift session.
   *
   * <p>The BE validates the JWT against Google's JWKS, then either links
   * the verified Google identity to an existing user (by {@code subject}
   * or verified {@code email}) or auto-provisions a new {@code TEACHER}
   * account inside the tenant named by {@code X-Tenant-Slug}. The
   * returned shape is the same {@link AuthSession} as `/login`, so the
   * rest of the boot pipeline (setSession → me → navigate) works
   * identically.
   *
   * <p>No bearer header is sent — the endpoint is public, like
   * {@link login}. The tenant slug must already be set in
   * {@code TenantService} (the caller does that on click) so the
   * {@code tenantInterceptor} forwards it correctly.
   */
  loginWithGoogle(payload: GoogleLoginRequest): Observable<AuthSession> {
    return this.api.post<AuthResponseRaw>(API.AUTH.GOOGLE, payload).pipe(map(toAuthSession));
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

  /**
   * Inspect a reset-password token without consuming it (Sprint 17 / BE-17.1).
   * Used by the {@code /auth/reset-password} page to decide whether to
   * render the form or an "expired link" message before the user types
   * anything.
   */
  validateResetToken(token: string): Observable<ResetPasswordValidateResponse> {
    return this.api
      .get<ApiResponse<ResetPasswordValidateResponse>>(API.AUTH.RESET_PASSWORD_VALIDATE, { token })
      .pipe(map((envelope) => envelope.data));
  }

  resetPassword(payload: ResetPasswordRequest): Observable<void> {
    return this.api.post<void>(API.AUTH.RESET_PASSWORD, payload);
  }

  // ---------------------------------------------------------------------------
  // MFA (Sprint 17 / BE-17.2 + FE-17.3)
  // ---------------------------------------------------------------------------
  //
  // Why these live on the auth service (and not on a separate MfaService): the
  // endpoints sit under /v1/auth/mfa/* and the only "MFA module" in the FE is
  // the auth flow itself. Splitting the service would add indirection without
  // buying testability — the methods are short, stateless, and only consumed
  // by the auth shell pages.
  //
  // We deliberately do NOT use `this.api.post(...)` here for the challenge
  // endpoint because the call must carry the `mfaToken` as the bearer — the
  // standard interceptor (api-url → tenant → auth) is happy to do that, but
  // we want the bearer to be the MfaToken, not the (still-valid) refresh token
  // the user has from a previous successful login. The caller passes it via
  // the standard `Authorization: Bearer` header set by the auth interceptor.

  /** Step 1 of enrollment: returns the secret + QR code data URL. */
  startMfaEnrollment(): Observable<MfaEnrollmentStart> {
    return this.api
      .get<ApiResponse<MfaEnrollmentStart>>(API.AUTH.MFA_ENROLL_START)
      .pipe(map((envelope) => envelope.data));
  }

  /**
   * Step 2 of enrollment: validates the first TOTP code. Returns
   * 10 recovery codes (plaintext, shown to the user once).
   */
  verifyMfaEnrollment(payload: MfaEnrollVerifyRequest): Observable<MfaEnrollVerifyResponse> {
    return this.api.post<MfaEnrollVerifyResponse, MfaEnrollVerifyRequest>(
      API.AUTH.MFA_ENROLL_VERIFY,
      payload,
    );
  }

  /**
   * Completes the MFA step of the login flow. The caller must
   * present the `mfaToken` returned by `/auth/login` as the bearer.
   * On success returns the same `AuthSession` shape as
   * `/auth/login` so the rest of the boot pipeline works
   * identically.
   */
  challengeMfa(payload: MfaChallengeRequest): Observable<AuthSession> {
    return this.api
      .post<AuthResponseRaw, MfaChallengeRequest>(API.AUTH.MFA_CHALLENGE, payload)
      .pipe(map(toAuthSession));
  }

  /** Disable MFA on the authenticated account. */
  disableMfa(payload: MfaDisableRequest): Observable<void> {
    return this.api.post<void>(API.AUTH.MFA_DISABLE, payload);
  }

  /** Regenerate the recovery code set (invalidates the old 10). */
  regenerateMfaRecoveryCodes(payload: MfaRegenerateRequest): Observable<MfaEnrollVerifyResponse> {
    return this.api.post<MfaEnrollVerifyResponse, MfaRegenerateRequest>(
      API.AUTH.MFA_REGENERATE_RECOVERY,
      payload,
    );
  }
}
