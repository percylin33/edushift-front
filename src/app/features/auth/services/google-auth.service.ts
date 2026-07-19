import { Injectable, Optional, computed, inject, signal } from '@angular/core';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { environment } from '@env/environment';

/**
 * Thin FE wrapper around the third-party {@code @abacritt/angularx-social-login}
 * library so consumers don't have to know which provider abstraction we
 * standardized on.
 *
 * <h3>What this service owns</h3>
 * <ul>
 *   <li>Surfacing the "is Google enabled in this environment" flag via
 *       {@link isEnabled} — consumed by {@code LoginComponent} to decide
 *       whether to render the {@code GoogleSigninButtonComponent}.</li>
 *   <li>Triggering the popup-based {@code signIn} call against the
 *       provider id we registered in {@code core.providers.ts}.</li>
 * </ul>
 *
 * <h3>What this service does NOT own</h3>
 * <ul>
 *   <li>The {@code SocialLoginModule} wiring and provider registration —
 *       that's done once at app boot in {@code core.providers.ts}.</li>
 *   <li>The actual HTTP call to {@code POST /v1/auth/google} — that's
 *       {@code AuthApiService.loginWithGoogle}.</li>
 *   <li>Session persistence / user fetching — those run after the token
 *       is sent to the BE, exactly like a normal {@code /login} round
 *       trip (see {@code LoginComponent}).</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private readonly social = inject(SocialAuthService, { optional: true });

  /** Provider id we register with `SocialLoginModule`. Keep in sync with `core.providers.ts`. */
  static readonly PROVIDER_ID = 'google';

  /** Configured Google Client ID, exposed for diagnostics. */
  readonly clientId = environment.google.clientId;

  /** Mirrors {@code environment.google.enabled}. Computed so it reacts to
   *  any future hot-reload of the env file (HMR during dev). */
  readonly isEnabled = computed(() => environment.google.enabled);

  /** Local busy flag — set when the popup is open, cleared on resolve/error. */
  private readonly _busy = signal(false);
  readonly busy = this._busy.asReadonly();

  /**
   * Open the Google account chooser and resolve with the picked identity.
   *
   * <p>The {@code @abacritt/angularx-social-login} library returns the
   * authenticated user straight from {@code signIn()}; we just wait on
   * the promise. No RxJS plumbing needed.
   *
   * @throws if the user closes the popup, denies consent, or the
   *         configured Client ID is rejected. The error message is
   *         suitable for direct UI display.
   */
  async signIn(): Promise<{ idToken: string; email?: string }> {
    if (!this.isEnabled() || !this.social) {
      throw new Error('Google Sign-in is not enabled in this environment.');
    }
    this._busy.set(true);
    try {
      const user = await this.social.signIn(GoogleAuthService.PROVIDER_ID);
      if (!user?.idToken) {
        throw new Error('Google no devolvió un token válido.');
      }
      return { idToken: user.idToken, email: user.email };
    } finally {
      this._busy.set(false);
    }
  }

  /**
   * Disconnect the current Google account from this app. Mainly useful
   * for the "Switch account" UX; not wired yet.
   */
  async signOut(): Promise<void> {
    if (!this.social) {
      return;
    }
    await this.social.signOut(true);
  }
}
