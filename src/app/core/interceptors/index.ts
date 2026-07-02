import { HttpInterceptorFn } from '@angular/common/http';
import { apiUrlInterceptor } from './api-url.interceptor';
import { authInterceptor } from './auth.interceptor';
import { tenantInterceptor } from './tenant.interceptor';
import { loadingInterceptor } from './loading.interceptor';
import { tokenRefreshInterceptor } from './token-refresh.interceptor';
import { errorInterceptor } from './error.interceptor';

export {
  apiUrlInterceptor,
  authInterceptor,
  tenantInterceptor,
  loadingInterceptor,
  tokenRefreshInterceptor,
  errorInterceptor,
};

/**
 * Ordered list of HTTP interceptors. Order matters — and it matters in
 * a way that's easy to get wrong, so read this carefully before
 * touching it.
 *
 * <h3>How Angular's functional interceptor chain orders execution</h3>
 * For {@code withInterceptors([A, B, C])}:
 * <ul>
 *   <li><strong>Request flows top-down:</strong> the consumer's call
 *       is intercepted by {@code A} first, then {@code B}, then
 *       {@code C}, which finally calls the backend.</li>
 *   <li><strong>Response flows bottom-up:</strong> the response (or
 *       error) returns through {@code C} first, then {@code B}, then
 *       {@code A}, then to the original caller.</li>
 * </ul>
 * <p>
 * The implication for {@code catchError}: the interceptor LOWEST in the
 * array gets the first crack at every error. If two interceptors both
 * want to react to a 401, the one closer to the bottom wins —
 * everything above it sees whatever it propagates (or nothing, if it
 * swallowed the error).
 *
 * <h3>Why tokenRefresh sits below error</h3>
 * It must see the 401 BEFORE {@code errorInterceptor} would otherwise
 * call {@code auth.clearSession()} and bounce to /login. With
 * {@code tokenRefresh} below {@code error}, the chain becomes:
 * <pre>
 * 401 from backend
 *    → tokenRefresh.catchError    // tries silent refresh + retry
 *        success → response propagates upward as 200, error never reaches errorInterceptor
 *        failure → re-throws original 401
 *            → error.catchError    // clears session, redirects to /login with returnUrl
 * </pre>
 *
 * <h3>Order — final form</h3>
 *  1. api-url       → resolve relative `api/...` paths first
 *  2. tenant        → attach `X-Tenant-Slug` for /auth/login
 *  3. auth          → attach `Authorization: Bearer <accessToken>`
 *  4. loading       → start/stop pending counter around the request
 *  5. error         → fallback handler (only sees errors tokenRefresh
 *                     couldn't cure — dead refresh, /auth/* legitimately
 *                     401-ing, 403, 5xx, network failures)
 *  6. tokenRefresh  → silent refresh on 401 to non-auth endpoints,
 *                     retries the original request once with the rotated
 *                     access token. THIS IS LAST ON PURPOSE.
 */
export const HTTP_INTERCEPTORS_CHAIN: HttpInterceptorFn[] = [
  apiUrlInterceptor,
  tenantInterceptor,
  authInterceptor,
  loadingInterceptor,
  errorInterceptor,
  tokenRefreshInterceptor,
];
