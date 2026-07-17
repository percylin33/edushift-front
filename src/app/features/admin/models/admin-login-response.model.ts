/**
 * Wire shape returned by `POST /v1/admin/login`.
 *
 * <p>Mirrors the backend `AdminLoginResponse` record. Carries
 * {@code expiresInSec} (TTL in seconds), {@code firstName}/{@code lastName}
 * (no concatenated fullName on the wire), and a flat roles array
 * (the same shape `AuthResponse.user.roles` carries on the regular
 * login endpoint).</p>
 *
 * <p>This shape is private to the admin feature; the public surface is
 * the normalized {@link AuthSession} returned by
 * {@code AdminAuthApiService.login}. See {@code toAdminAuthSession}
 * in {@code core/adapters/auth-session.adapter.ts} for the mapping.</p>
 */
export interface AdminLoginResponseRaw {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSec: number;
  user: {
    publicUuid: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    roles: string[];
  };
}

/**
 * Wire shape returned by `POST /v1/admin/login` when the SUPER_ADMIN has
 * not yet enrolled MFA (Sprint 15 / F-02 / H-02).
 *
 * <p>The BE issues a short-lived {@code ONBOARDING} JWT that the client
 * can either spend against {@code POST /admin/mfa/enrol} +
 * {@code POST /admin/mfa/verify-enrol} (production flow with a real
 * authenticator app) or against the dev-only
 * {@code POST /admin/dev/complete-mfa} (Sprint 15 follow-up). The
 * {@code AdminAuthApiService} transparently handles the latter when the
 * FE is running in dev profile and a bypass code is configured.</p>
 */
export interface AdminMfaRequiredRaw {
  onboardingToken: string;
  expiresInSec: number;
  tokenType: string;
  reason: 'MFA_ENROLMENT_REQUIRED' | string;
}

/**
 * Discriminated union over the two shapes {@code POST /admin/login}
 * can return. The service normalizes either into an {@link AuthSession}
 * for callers (auto-bypassing MFA in dev) or surfaces a typed error
 * when the bypass path is unavailable.
 */
export type AdminLoginRaw = AdminLoginResponseRaw | AdminMfaRequiredRaw;

/**
 * Type guard: a payload carries a session if it has the access/refresh
 * pair. The BE never returns both shapes at the same time.
 */
export function isAdminMfaRequired(
  raw: AdminLoginRaw,
): raw is AdminMfaRequiredRaw {
  return (
    typeof (raw as AdminMfaRequiredRaw).onboardingToken === 'string'
    && (raw as AdminLoginResponseRaw).accessToken === undefined
  );
}
