import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { toAdminAuthSession } from '@core/adapters';
import { AuthSession } from '@core/models';
import { environment } from '@env/environment';
import {
  AdminLoginRequest,
  AdminLoginResponseRaw,
  AdminMfaRequiredRaw,
  AdminLoginRaw,
  isAdminMfaRequired,
} from '../models';

interface DevCompleteMfaResponseRaw {
  success: boolean;
  data: {
    session: AdminLoginResponseRaw;
    bootstrap?: {
      totpSecret: string;
      otpauthUri: string;
      recoveryCodes: string[];
    };
  };
}

@Injectable({ providedIn: 'root' })
export class AdminAuthApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  /**
   * Login a SUPER_ADMIN and return the normalized {@link AuthSession}.
   *
   * <p>The wire shape carries {@code expiresInSec} (TTL in seconds),
   * firstName/lastName, and a flat roles array. The adapter maps them
   * into the project-internal {@link AuthSession} so the same
   * {@code AuthService.setSession(...)} pipeline used by the regular
   * login flow works unchanged. Without that normalization step the
   * session would be persisted with {@code expiresAt = Invalid Date}
   * (since the wire has no ISO string) and with
   * {@code user.roles = undefined} (which collapses the roleGuard
   * downstream and silently routes the SUPER_ADMIN into the regular
   * workspace layout).</p>
   *
   * <h3>Dev-only MFA bypass (Sprint 15 / F-02 follow-up)</h3>
   * If the BE responds with {@code MFA_ENROLMENT_REQUIRED} (the
   * SUPER_ADMIN has not yet enrolled TOTP) and the FE is running in
   * a non-prod profile with {@code environment.devMfaBypassCode} set,
   * this service transparently spends the onboarding bearer against
   * {@code POST /admin/dev/complete-mfa} and returns the resulting
   * session. In production the bypass field is undefined so the BE's
   * MFA-required response surfaces as a {@link MfaEnrolmentRequiredError}
   * — callers can render a proper enrolment UI instead of silently
   * bypassing.</p>
   */
  login(payload: AdminLoginRequest): Observable<AuthSession> {
    return this.api
      .post<AdminLoginRaw>(API.ADMIN.AUTH.LOGIN, payload)
      .pipe(
        switchMap((raw) => this.maybeAutoBypass(raw)),
        map((session) => toAdminAuthSession(session)),
      );
  }

  /**
   * Internal: if the BE returned the MFA-required envelope and the
   * current FE build is eligible to bypass, spend the onboarding
   * bearer against {@code POST /admin/dev/complete-mfa}. Otherwise
   * surface a typed error so the login UI can render a meaningful
   * message.
   */
  private maybeAutoBypass(raw: AdminLoginRaw): Observable<AdminLoginResponseRaw> {
    if (!isAdminMfaRequired(raw)) {
      return of(raw);
    }
    const bypassCode = environment.devMfaBypassCode;
    if (environment.production || !bypassCode) {
      return throwError(() => new MfaEnrolmentRequiredError(raw));
    }
    // bypassCode is narrowed to string by the `!bypassCode` guard above.
    return this.completeDevMfa(raw, bypassCode as string);
  }

  private completeDevMfa(
    raw: AdminMfaRequiredRaw,
    bypassCode: string,
  ): Observable<AdminLoginResponseRaw> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${raw.onboardingToken}`,
      'X-Dev-Code': bypassCode,
    });
    return this.http
      .post<DevCompleteMfaResponseRaw>(API.ADMIN.AUTH.DEV_COMPLETE_MFA, {}, { headers })
      .pipe(
        map((resp) => resp?.data?.session),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) {
            return throwError(() => new MfaEnrolmentRequiredError(raw));
          }
          if (err.status === 409) {
            return throwError(() => new MfaEnrolmentRequiredError(
              raw,
              'MFA ya estaba enrolado; reinicia el flujo de login.',
            ));
          }
          return throwError(() => err);
        }),
      );
  }
}

/**
 * Thrown when the BE returns the {@code MFA_ENROLMENT_REQUIRED}
 * envelope and the current FE build is not eligible to bypass (i.e.
 * production or no bypass code configured). Carries the onboarding
 * token so callers can offer a proper enrolment UI if one exists.
 */
export class MfaEnrolmentRequiredError extends Error {
  readonly onboardingToken: string;
  readonly expiresInSec: number;
  constructor(raw: AdminMfaRequiredRaw, message?: string) {
    super(
      message
        ?? 'Esta cuenta requiere enrolar MFA. Completa el enrolamiento antes de iniciar sesión.',
    );
    this.name = 'MfaEnrolmentRequiredError';
    this.onboardingToken = raw.onboardingToken;
    this.expiresInSec = raw.expiresInSec;
    // Required when transpiling to ES5 so `instanceof MfaEnrolmentRequiredError`
    // works across module boundaries.
    Object.setPrototypeOf(this, MfaEnrolmentRequiredError.prototype);
  }
}
