/**
 * Response of `POST /v1/auth/mfa/enroll/start` (Sprint 17 / BE-17.2).
 *
 * The BE returns the *base32 secret* (rendered as the
 * `secretBase32` field — used by the FE only as an
 * "I can't scan, type it manually" fallback) plus the
 * `qrCodeDataUrl` which the FE renders as a QR code. The
 * `otpauthUri` is the standard otpauth:// URL that authenticator
 * apps understand; we keep it for debugging / third-party tools.
 */
export interface MfaEnrollmentStart {
  secretBase32: string;
  qrCodeDataUrl: string;
  otpauthUri: string;
}

/**
 * Body of `POST /v1/auth/mfa/enroll/verify`. The FE echoes the
 * `secret` it received from the start endpoint so the BE can
 * validate the first TOTP code against the same secret it generated
 * (defence in depth: the FE is not the source of truth).
 */
export interface MfaEnrollVerifyRequest {
  secret: string;
  totpCode: string;
}

/**
 * Response of `POST /v1/auth/mfa/enroll/verify` — 10 plaintext
 * recovery codes (one-time use). The FE shows them once and never
 * again; the user must save them. The BE stores the BCrypt hashes
 * server-side.
 */
export type MfaEnrollVerifyResponse = string[];

/**
 * Body of `POST /v1/auth/mfa/challenge`. Sent as the JSON body
 * while the {@code mfaToken} is the bearer. The BE accepts either
 * a 6-digit TOTP or a 10-char recovery code.
 */
export interface MfaChallengeRequest {
  code: string;
}

/**
 * Body of `POST /v1/auth/mfa/disable`. The current password is
 * required to prove identity even when authenticated; the
 * TOTP/recovery code is the second factor. Both must be valid
 * for the BE to clear MFA state.
 */
export interface MfaDisableRequest {
  currentPassword: string;
  mfaCode: string;
}

/**
 * Body of `POST /v1/auth/mfa/recovery-codes/regenerate`. Requires
 * the current password (proof of identity). Invalidates the
 * previous recovery code set and issues a fresh 10.
 */
export interface MfaRegenerateRequest {
  currentPassword: string;
}
