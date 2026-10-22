import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { CreatePlanRequest, PlanAiPolicy, PlanAnalytics, PlatformPlan, UpdatePlanRequest } from '../models';
import { catchError, forkJoin, map, Observable, of, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminPlansService {
  private readonly api = inject(ApiService);
  private readonly _plans = signal<PlatformPlan[]>([]);
  private readonly _analytics = signal<PlanAnalytics[]>([]);
  private readonly _policies = signal<Record<string, PlanAiPolicy>>({});
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly plans = this._plans.asReadonly();
  readonly analytics = this._analytics.asReadonly();
  readonly policies = this._policies.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  loadCatalog(): void {
    this._loading.set(true);
    this._error.set(null);
    forkJoin({
      plans: this.api.get<{ data: Record<string, unknown>[] }>(API.ADMIN.PLANS_ROOT, { includeInactive: true }),
      analytics: this.api.get<{ data: PlanAnalytics[] }>(API.ADMIN.PLANS_ANALYTICS),
      policies: this.api.get<{ data: PlanAiPolicy[] }>(API.ADMIN.PLAN_AI_POLICIES).pipe(
        // Seeded or newly created plans may not have an AI policy yet.
        catchError(() => of({ data: [] })),
      ),
    }).subscribe({
      next: (result) => {
        this._plans.set((result.plans.data ?? []).map((plan) => this.toPlan(plan)));
        this._analytics.set(result.analytics.data ?? []);
        this._policies.set(Object.fromEntries((result.policies.data ?? []).map((policy) => [policy.planId, policy])));
        this._loading.set(false);
      },
      error: (err: unknown) => {
        this._error.set(this.errorMessage(err, 'No se pudo cargar el catálogo de planes.'));
        this._loading.set(false);
      },
    });
  }

  createPlan(request: CreatePlanRequest): Observable<PlatformPlan> {
    return this.api.post<{ data: Record<string, unknown> }>(API.ADMIN.PLANS_ROOT, request).pipe(
      map((response) => this.toPlan(response.data)),
    );
  }

  updatePlan(uuid: string, request: UpdatePlanRequest): Observable<PlatformPlan> {
    return this.api.patch<{ data: Record<string, unknown> }>(API.ADMIN.PLANS_BY_ID(uuid), request).pipe(
      map((response) => this.toPlan(response.data)),
    );
  }

  saveAiPolicy(policy: PlanAiPolicy): Observable<PlanAiPolicy> {
    return this.api.put<{ data: PlanAiPolicy }>(API.ADMIN.PLAN_AI_POLICY(policy.planId), policy).pipe(
      map((response) => response.data),
      tap((saved) => this._policies.update((policies) => ({ ...policies, [saved.planId]: saved }))),
    );
  }

  setPlanActive(uuid: string, isActive: boolean): Observable<PlatformPlan> {
    return this.updatePlan(uuid, { isActive });
  }

  private toPlan(raw: Record<string, unknown>): PlatformPlan {
    return {
      publicUuid: String(raw['id'] ?? raw['publicUuid'] ?? ''),
      name: String(raw['name'] ?? ''),
      code: String(raw['code'] ?? ''),
      description: typeof raw['description'] === 'string' ? raw['description'] : undefined,
      pricePerStudentCents: Number(raw['pricePerStudentCents'] ?? 0),
      maxStudents: typeof raw['maxStudents'] === 'number' ? raw['maxStudents'] : undefined,
      maxTeachers: typeof raw['maxTeachers'] === 'number' ? raw['maxTeachers'] : undefined,
      maxStorageMb: typeof raw['maxStorageMb'] === 'number' ? raw['maxStorageMb'] : undefined,
      sortOrder: Number(raw['sortOrder'] ?? 0),
      features: Array.isArray(raw['features']) ? raw['features'].filter((feature): feature is string => typeof feature === 'string') : [],
      isActive: Boolean(raw['isActive']),
      createdAt: String(raw['createdAt'] ?? ''),
      updatedAt: String(raw['updatedAt'] ?? ''),
    };
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const payload = (error as { error?: { message?: unknown } }).error;
      if (typeof payload?.message === 'string') return payload.message;
    }
    return fallback;
  }
}
