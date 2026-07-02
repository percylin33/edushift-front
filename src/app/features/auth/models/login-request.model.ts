export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

/**
 * Body of {@code POST /v1/auth/google}. The FE obtains the {@code id_token}
 * from the Google Identity Services popup (via `angularx-social-login`),
 * then ships it as-is to the BE which validates the signature against
 * Google's JWKS, the audience (our OAuth Client ID) and the issuer.
 */
export interface GoogleLoginRequest {
  /** JWT issued by Google. Already base64url-decoded by the GSI library. */
  idToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  passwordConfirmation: string;
}
