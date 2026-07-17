import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, defer, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from '@core/services';
import { TenantService } from '@core/services';
import { CapabilityStep, HttpMethod, StepRunResult } from '../models/qa.model';

export interface QaRunnerContext {
  /**
   * API base URL. Defaults to {@code environment.apiUrl}/{@code environment.apiVersion}
   * when omitted. Endpoints in the catalog are stored as paths relative to this.
   */
  baseUrl?: string;
  token?: string | null;
  tenantSlug?: string | null;
}

const TENANT_PREFIXES = [
  '/v1/auth/',
  '/v1/users/',
  '/v1/students/',
  '/v1/teachers/',
  '/v1/learning-sessions',
  '/v1/sessions',
  '/v1/attendance',
  '/v1/evaluations',
  '/v1/quizzes',
  '/v1/materials',
  '/v1/lms',
  '/v1/tasks',
  '/v1/schedule',
  '/v1/payments',
  '/v1/tenants',
  '/v1/notifications',
  '/v1/dashboard',
  '/v1/files',
  '/v1/ai',
  '/v1/help/',
  '/v1/invitation',
  '/v1/onboarding',
  '/v1/reports',
  '/v1/audit',
];

/**
 * Executes a {@link CapabilityStep} over the live backend.
 *
 * <h3>Why it exists</h3>
 * The wizard needs full control of the request (override headers, custom
 * success criteria, manual confirmation step) which the default
 * {@code ApiService} doesn't expose directly.
 *
 * <h3>Safety</h3>
 * <ul>
 *   <li>Tokens are read once from {@code AuthService} and never logged
 *       or persisted — only the marker {@code Bearer ****} survives.</li>
 *   <li>The {@code X-Tenant-Slug} header is only attached when the target
 *       path starts with a known tenant-scoped prefix (everything under
 *       {@code /v1/admin/*} ignores the header).</li>
 *   <li>Mutating verbs (POST/PUT/PATCH/DELETE) honour
 *       {@code step.autoExecute}: false is the safe default, callers
 *       must explicitly opt in.</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class QaRunnerService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly tenantService = inject(TenantService);

  run(step: CapabilityStep, ctx: QaRunnerContext = {}): Observable<StepRunResult> {
    if (step.successCriteria.kind === 'manualConfirm') {
      return of({
        ok: false,
        manual: true,
        prompt: step.successCriteria.prompt,
        durationMs: 0,
      });
    }
    if (!step.endpoint) {
      return of({
        ok: false,
        manual: true,
        prompt: 'Este paso no ejecuta HTTP — confírmalo manualmente.',
        durationMs: 0,
      });
    }
    if (!step.autoExecute) {
      return of({
        ok: false,
        manual: true,
        prompt:
          'Este paso es de mutación y está en modo manual. Confírmalo y vuelve a intentarlo con autoExecute.',
        durationMs: 0,
      });
    }

    const token = ctx.token ?? this.auth.accessToken();
    const tenantSlug = ctx.tenantSlug ?? this.tenantService.tenantSlug();
    const base = ctx.baseUrl ?? `${environment.apiUrl}/${environment.apiVersion}`;
    return this.execute(step, base, token, tenantSlug);
  }

  private execute(
    step: CapabilityStep,
    baseUrl: string,
    token: string | null,
    tenantSlug: string | null,
  ): Observable<StepRunResult> {
    const endpoint = step.endpoint!;
    const url = `${this.normalizeBase(baseUrl)}${endpoint.path}`;
    const headers = this.buildHeaders(token, tenantSlug, endpoint.path);
    const startedAt = performance.now();

    const request$ = defer(() => {
      const opts = { headers };
      switch (endpoint.method) {
        case 'GET':
          return this.http.get<unknown>(url, opts);
        case 'POST':
          return this.http.post<unknown>(url, step.defaultPayload ?? {}, opts);
        case 'PUT':
          return this.http.put<unknown>(url, step.defaultPayload ?? {}, opts);
        case 'PATCH':
          return this.http.patch<unknown>(url, step.defaultPayload ?? {}, opts);
        case 'DELETE':
          return this.http.delete<unknown>(url, opts);
      }
    });

    return request$.pipe(
      map((body) => {
        const status = this.guessStatus(endpoint.method);
        return this.evaluate(step, { status, body, durationMs: performance.now() - startedAt });
      }),
      catchError((err: HttpErrorResponse) => {
        const status = err.status ?? 0;
        const body = err.error ?? null;
        return of(
          this.evaluate(step, {
            status,
            body,
            durationMs: performance.now() - startedAt,
          }),
        );
      }),
    );
  }

  private evaluate(
    step: CapabilityStep,
    raw: { status: number; body: unknown; durationMs: number },
  ): StepRunResult {
    const { status, body, durationMs } = raw;
    const criteria = step.successCriteria;
    let ok = false;
    let manual = false;
    let prompt: string | undefined;

    if (criteria.kind === 'status') {
      const expected = Array.isArray(criteria.value) ? criteria.value : [criteria.value];
      ok = expected.includes(status);
    } else if (criteria.kind === 'bodyContains') {
      const text = JSON.stringify(body ?? '') ?? '';
      ok = text.includes(criteria.value);
    } else {
      manual = true;
      prompt = criteria.prompt;
      ok = false;
    }

    const errorMessage = !ok
      ? manual
        ? prompt
        : `Status ${status} no cumple el criterio de éxito del step.`
      : undefined;

    return {
      ok,
      status,
      body: body ?? null,
      durationMs,
      manual,
      prompt,
      ...(errorMessage ? { errorMessage } : {}),
    };
  }

  /**
   * `HttpClient` doesn't surface the success status code through a typed
   * body response, so we infer a plausible 2xx for the happy path. Errors
   * route through `catchError` and end up with the real status.
   */
  private guessStatus(method: HttpMethod): number {
    return method === 'POST' ? 201 : 200;
  }

  private buildHeaders(
    token: string | null,
    tenantSlug: string | null,
    path: string,
  ): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    const needsTenant = TENANT_PREFIXES.some((p) => path.startsWith(p));
    if (needsTenant && tenantSlug) {
      headers = headers.set('X-Tenant-Slug', tenantSlug);
    }
    return headers;
  }

  private normalizeBase(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
  }
}
