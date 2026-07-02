/**
 * Response shape returned by {@code POST /v1/auth/login} (or Google) when
 * the user has MFA enabled (Sprint 17 / BE-17.2). Replaces the
 * full {@link AuthSession} for that call; the SPA must then complete
 * the flow at {@code POST /v1/auth/mfa/challenge} (with the bearer
 * set to the {@code mfaToken}).
 *
 * @param mfaToken     short-lived signed JWT (default TTL 5 min) that
 *                     proves the password check happened. Required as
 *                     the {@code Authorization: Bearer} header on
 *                     {@code /mfa/challenge}.
 * @param expiresInSec seconds until the {@code mfaToken} expires; used
 *                     by the FE to render a countdown / warn the user.
 * @param tokenType    always {@code "Bearer"} (RFC 6750 compliance).
 */
export interface MfaRequiredResponse {
  mfaToken: string;
  expiresInSec: number;
  tokenType: string;
}
