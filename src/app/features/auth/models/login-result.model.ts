import { AuthSession } from '@core/models';
import { MfaRequiredResponse } from '@features/auth/models';

/**
 * Result of {@code AuthApiService.login / loginWithGoogle}.
 *
 * <h3>Why a sealed type</h3>
 * Starting Sprint 17 / BE-17.2, a successful password check may
 * still require an MFA step before the SPA can issue a full session
 * (ADR-17.1). The BE surfaces this by returning one of two
 * shapes for the same endpoint:
 *
 * <ul>
 *   <li><b>Session</b> — the user is fully logged in. The SPA
 *       stores the session, hits {@code /me}, and navigates to
 *       the dashboard.</li>
 *   <li><b>MfaRequired</b> — the user has a short-lived
 *       {@code mfaToken}. The SPA redirects to
 *       {@code /auth/mfa-challenge} and continues the flow there.</li>
 * </ul>
 *
 * Pattern matching on this sealed type makes the call site
 * exhaustive and forces a decision at every consumer.
 */
export type LoginResult = LoginResultSession | LoginResultMfaRequired;

export interface LoginResultSession {
  readonly kind: 'session';
  readonly session: AuthSession;
}

export interface LoginResultMfaRequired {
  readonly kind: 'mfa-required';
  readonly mfa: MfaRequiredResponse;
}
