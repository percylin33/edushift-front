/**
 * Response of `GET /v1/auth/reset-password/validate?token=...` (Sprint 17 / BE-17.1).
 *
 * The endpoint always responds 200 OK and uses the {@code valid} flag
 * to surface the outcome — the FE renders the right copy based on the
 * combination of {@code valid} + {@code reasonCode}.
 */
export interface ResetPasswordValidateResponse {
  /** When {@code true} the token is redeemable right now. */
  valid: boolean;

  /** Display name of the tenant the link belongs to (e.g. "Acme School"). */
  tenantName: string | null;

  /** Slug of the tenant the link belongs to (e.g. "acme"). */
  tenantSlug: string | null;

  /**
   * Absolute expiration timestamp (UTC). Useful if the FE wants to
   * render a countdown — currently unused but kept for future UX.
   */
  expiresAt: string | null;

  /**
   * Stable error code when {@code valid} is {@code false}. Mirrors the
   * backend's `RESET_TOKEN_*` codes. `null` when the token is valid.
   */
  reasonCode:
    | 'RESET_TOKEN_EXPIRED'
    | 'RESET_TOKEN_USED'
    | 'RESET_TOKEN_SUPERSEDED'
    | 'RESET_TOKEN_MISSING'
    | 'RESET_TOKEN_TENANT_NOT_FOUND'
    | 'RESET_TOKEN_MALFORMED'
    | 'RESET_TOKEN_INVALID'
    | 'RESET_TOKEN_WRONG_TYPE'
    | null;
}
