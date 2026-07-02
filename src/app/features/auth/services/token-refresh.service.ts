import { Injectable, inject } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { AuthService } from '@core/services';
import { AuthApiService } from './auth-api.service';

/**
 * Coordinator for the silent (reactive) access-token refresh flow.
 *
 * <h3>What problem this solves</h3>
 * The access token expires every 15 min. Without this service, the next
 * outbound request after that boundary would fail with 401, the
 * {@code errorInterceptor} would clear the session and bounce the user
 * back to login — even though they have a perfectly valid refresh
 * token sitting in storage. That's a terrible UX for a SaaS that's
 * meant to be open in a tab for hours.
 *
 * <h3>Single-flight discipline</h3>
 * The most common shape of the bug it prevents is concurrent 401s: when
 * the dashboard loads it usually fires several parallel requests. If
 * each request triggered its own {@code POST /auth/refresh}, the
 * backend's refresh-token rotation would spot the second call as token
 * reuse and (correctly, by spec) revoke the entire chain — locking the
 * user out. Instead, the very first caller starts the refresh and
 * every subsequent caller during that window {@link #refresh}
 * subscribes to the same shared Observable.
 *
 * <h4>Mechanics</h4>
 * <ul>
 *   <li>{@code inflight$} holds the live shared Observable while a
 *       refresh is in progress; {@code null} otherwise.</li>
 *   <li>{@link shareReplay} with {@code bufferSize: 1, refCount: false}
 *       keeps the emitted token cached for late joiners and prevents
 *       upstream re-execution if all subscribers leave temporarily.</li>
 *   <li>{@link finalize} (which runs <em>before</em> the {@code shareReplay}
 *       in pipe order, hence on the upstream's terminal event) nulls
 *       out {@code inflight$} so the next 401 cycle can start fresh.</li>
 *   <li>On error we {@link AuthService#clearSession} eagerly so the
 *       interceptor's downstream {@code errorInterceptor} sees a clean
 *       state when it picks up the bubbling exception and redirects
 *       to login.</li>
 * </ul>
 *
 * <h3>Why this lives under {@code features/auth}</h3>
 * The interceptor is global (core) but the orchestration of "what does
 * a refresh actually mean" — store rotation, session swap, error
 * semantics — belongs to the auth feature. The interceptor imports
 * this service directly (via path), keeping the dependency direction
 * one-way and avoiding a circular {@code core → features → core} loop
 * through barrel re-exports.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private readonly auth = inject(AuthService);

  private readonly authApi = inject(AuthApiService);

  private inflight$: Observable<string> | null = null;

  /**
   * Returns an Observable that emits the new access token once the
   * (possibly already in-flight) refresh completes. Resolves with an
   * error if no refresh token is present (caller should treat this as
   * "session is dead, log out") or if the backend rejects the token.
   */
  refresh(): Observable<string> {
    if (this.inflight$) return this.inflight$;

    const refreshToken = this.auth.refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('NO_REFRESH_TOKEN'));
    }

    this.inflight$ = this.authApi.refresh(refreshToken).pipe(
      /* Use `rotateTokens` (not `setSession`) so the cached rich
       * `User` (with roles/permissions from `/auth/me`) is preserved
       * across silent refreshes. `/auth/refresh` only returns the
       * 5-field `UserSummary`, so calling `setSession` here would
       * strip authorization data and collapse the navigation
       * sidebar to a single item ("only Dashboard" bug). */
      tap((session) => this.auth.rotateTokens(session)),
      map((session) => session.accessToken),
      finalize(() => {
        this.inflight$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.inflight$;
  }
}
