import { Injectable, computed, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '@core/constants';
import { Permission, UserRole } from '@core/enums';
import { AuthSession, User, UserSummary } from '@core/models';
import { StorageService } from './storage.service';

/**
 * Storage key for the short-lived {@code mfaToken} returned by
 * {@code /auth/login} when the user has MFA enabled. Persisted across
 * page reloads so a hard refresh on the challenge page does not
 * require the user to log in again.
 */
const MFA_TOKEN_STORAGE_KEY = 'edushift.mfaToken';
const MFA_TOKEN_EXPIRES_AT_KEY = 'edushift.mfaTokenExpiresAt';

/**
 * Auth state holder. No business logic — login/logout/refresh HTTP work
 * lives in {@code AuthApiService} (feature/auth). This service is the
 * single source of truth that guards, interceptors and shell components
 * read from, so it intentionally keeps no rxjs surface (only signals).
 *
 * <h3>State model</h3>
 * Three first-class signals back the public API:
 * <ul>
 *   <li>{@link #_user} — `UserSummary` after login, progressively enriched
 *       to a full `User` after {@code AuthApiService.me()}.</li>
 *   <li>{@link #_accessToken} — short-lived JWT used by the `Authorization`
 *       header.</li>
 *   <li>{@link #_refreshToken} — long-lived JWT used to rotate the pair;
 *       persisted so reloads don't kill the session.</li>
 *   <li>{@link #_expiresAt} — absolute access-token expiration. Used by
 *       interceptors / silent-refresh logic to decide proactively when
 *       to call `/auth/refresh`.</li>
 * </ul>
 *
 * <h3>Persistence</h3>
 * Everything is mirrored to {@link StorageService} (defaults to
 * `localStorage`). On bootstrap the constructor seeds the signals from
 * storage so a tab refresh keeps the session alive. The storage keys are
 * controlled by `environment.auth.*` so dev / prod can scope them
 * differently if ever needed.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = inject(StorageService);

  private readonly _user = signal<User | null>(this.storage.get<User>(STORAGE_KEYS.CURRENT_USER));
  private readonly _accessToken = signal<string | null>(
    this.storage.get<string>(STORAGE_KEYS.AUTH_TOKEN),
  );
  private readonly _refreshToken = signal<string | null>(
    this.storage.get<string>(STORAGE_KEYS.REFRESH_TOKEN),
  );
  private readonly _expiresAt = signal<Date | null>(this.readExpiresAt());

  // MFA challenge token (Sprint 17 / BE-17.2). Short-lived JWT
  // (default TTL 5 min) that proves the password check happened. Set
  // by the login flow when the user has MFA enabled; cleared on
  // successful challenge or on hard reload after expiration.
  private readonly _mfaToken = signal<string | null>(
    this.storage.get<string>(MFA_TOKEN_STORAGE_KEY),
  );
  private readonly _mfaTokenExpiresAt = signal<Date | null>(this.readMfaTokenExpiresAt());

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly refreshToken = this._refreshToken.asReadonly();
  readonly expiresAt = this._expiresAt.asReadonly();
  readonly mfaToken = this._mfaToken.asReadonly();
  readonly mfaTokenExpiresAt = this._mfaTokenExpiresAt.asReadonly();

  readonly isAuthenticated = computed(() => !!this._accessToken() && !!this._user());
  readonly roles = computed<UserRole[]>(() => this._user()?.roles ?? []);
  readonly permissions = computed<Permission[]>(() => this._user()?.permissions ?? []);

  /**
   * Persist a fresh session at login. Replaces user + tokens in full.
   *
   * <p>Only the login path should call this; the silent-refresh path uses
   * {@link #rotateTokens} so it doesn't downgrade the rich {@link User}
   * (with `roles`, `permissions`) back to a {@link UserSummary} (5
   * fields). See the rationale on {@link #rotateTokens}.
   *
   * <p>{@link UserSummary} is structurally assignable to {@link User}
   * because every field beyond the summary is optional on the User
   * interface — TypeScript does not widen the runtime shape, just allows
   * the assignment. The object is enriched later by {@link #setUser}
   * after {@code /auth/me}.
   */
  setSession(session: AuthSession): void {
    this._user.set(session.user as User);
    this._accessToken.set(session.accessToken);
    this._refreshToken.set(session.refreshToken);
    this._expiresAt.set(session.expiresAt);

    this.storage.set(STORAGE_KEYS.CURRENT_USER, session.user);
    this.storage.set(STORAGE_KEYS.AUTH_TOKEN, session.accessToken);
    this.storage.set(STORAGE_KEYS.REFRESH_TOKEN, session.refreshToken);
    this.storage.set(STORAGE_KEYS.AUTH_EXPIRES_AT, session.expiresAt.toISOString());
  }

  /**
   * Rotate just the token triple (access / refresh / expiresAt) without
   * touching the cached {@link User}.
   *
   * <p>This is the right primitive for the silent-refresh flow. The
   * backend's {@code POST /auth/refresh} returns the same minimal
   * {@link UserSummary} that login does (5 fields, no `roles` /
   * `permissions`) — overwriting the in-memory user with that summary
   * would silently strip authorization data and collapse the navigation
   * shell ("only Dashboard" bug). Since a refresh round-trip rotates
   * tokens for the same identity, the cached user is still authoritative
   * and we keep it as-is.
   */
  rotateTokens(session: AuthSession): void {
    this._accessToken.set(session.accessToken);
    this._refreshToken.set(session.refreshToken);
    this._expiresAt.set(session.expiresAt);

    this.storage.set(STORAGE_KEYS.AUTH_TOKEN, session.accessToken);
    this.storage.set(STORAGE_KEYS.REFRESH_TOKEN, session.refreshToken);
    this.storage.set(STORAGE_KEYS.AUTH_EXPIRES_AT, session.expiresAt.toISOString());
  }

  /** Replace the cached `UserSummary` with the richer `User` returned by `/auth/me`. */
  setUser(user: User): void {
    this._user.set(user);
    this.storage.set(STORAGE_KEYS.CURRENT_USER, user);
  }

  /** Wipe everything in memory + storage. Called from logout flows and 401 handlers. */
  clearSession(): void {
    this._user.set(null);
    this._accessToken.set(null);
    this._refreshToken.set(null);
    this._expiresAt.set(null);
    this.clearMfaToken();
    this.storage.remove(STORAGE_KEYS.CURRENT_USER);
    this.storage.remove(STORAGE_KEYS.AUTH_TOKEN);
    this.storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    this.storage.remove(STORAGE_KEYS.AUTH_EXPIRES_AT);
  }

  /**
   * Stash the short-lived MFA challenge token. The login flow calls
   * this right after {@code POST /auth/login} returns an
   * {@code MfaRequired} response, then navigates to
   * {@code /auth/mfa-challenge}. The challenge page reads the
   * token back via {@link mfaToken} and clears it on success
   * (via {@code clearMfaToken} inside {@code setSession}) or on
   * failure (via {@code clearMfaToken} inside the 401 handler).
   *
   * <p>Persisted to {@code localStorage} (default backend of
   * {@link StorageService}) so a hard refresh on the challenge page
   * doesn't force the user to log in again. The TTL is short (5 min)
   * so the risk of a stale token surviving past expiration is
   * minimal; the BE rejects expired tokens with
   * {@code MFA_TOKEN_INVALID} either way.
   */
  setMfaToken(token: string, expiresInSec: number): void {
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);
    this._mfaToken.set(token);
    this._mfaTokenExpiresAt.set(expiresAt);
    this.storage.set(MFA_TOKEN_STORAGE_KEY, token);
    this.storage.set(MFA_TOKEN_EXPIRES_AT_KEY, expiresAt.toISOString());
  }

  /** Clear the MFA challenge token (success, cancel, or 401). */
  clearMfaToken(): void {
    this._mfaToken.set(null);
    this._mfaTokenExpiresAt.set(null);
    this.storage.remove(MFA_TOKEN_STORAGE_KEY);
    this.storage.remove(MFA_TOKEN_EXPIRES_AT_KEY);
  }

  hasRole(...roles: UserRole[]): boolean {
    const owned = this.roles();
    return roles.some((r) => owned.includes(r));
  }

  hasPermission(...permissions: Permission[]): boolean {
    const owned = this.permissions();
    return permissions.some((p) => owned.includes(p));
  }

  hasAllPermissions(...permissions: Permission[]): boolean {
    const owned = this.permissions();
    return permissions.every((p) => owned.includes(p));
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private readExpiresAt(): Date | null {
    const iso = this.storage.get<string>(STORAGE_KEYS.AUTH_EXPIRES_AT);
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private readMfaTokenExpiresAt(): Date | null {
    const iso = this.storage.get<string>(MFA_TOKEN_EXPIRES_AT_KEY);
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
