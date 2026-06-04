import { Injectable, computed, inject, signal } from '@angular/core';
import { STORAGE_KEYS } from '@core/constants';
import { Permission, UserRole } from '@core/enums';
import { AuthSession, User, UserSummary } from '@core/models';
import { StorageService } from './storage.service';

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
  private readonly _accessToken = signal<string | null>(this.storage.get<string>(STORAGE_KEYS.AUTH_TOKEN));
  private readonly _refreshToken = signal<string | null>(this.storage.get<string>(STORAGE_KEYS.REFRESH_TOKEN));
  private readonly _expiresAt = signal<Date | null>(this.readExpiresAt());

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly refreshToken = this._refreshToken.asReadonly();
  readonly expiresAt = this._expiresAt.asReadonly();

  readonly isAuthenticated = computed(() => !!this._accessToken() && !!this._user());
  readonly roles = computed<UserRole[]>(() => this._user()?.roles ?? []);
  readonly permissions = computed<Permission[]>(() => this._user()?.permissions ?? []);

  /** Persist a fresh session (post-login or post-refresh). Replaces any prior session in full. */
  setSession(session: AuthSession): void {
    /* `UserSummary` is structurally assignable to `User` because every
     * field beyond the summary is `?` on the User interface — TypeScript
     * does NOT widen the runtime shape, just allows the assignment. The
     * object is enriched later by `setUser(...)` after `/auth/me`. */
    this._user.set(session.user as User);
    this._accessToken.set(session.accessToken);
    this._refreshToken.set(session.refreshToken);
    this._expiresAt.set(session.expiresAt);

    this.storage.set(STORAGE_KEYS.CURRENT_USER, session.user);
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
    this.storage.remove(STORAGE_KEYS.CURRENT_USER);
    this.storage.remove(STORAGE_KEYS.AUTH_TOKEN);
    this.storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    this.storage.remove(STORAGE_KEYS.AUTH_EXPIRES_AT);
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
}
