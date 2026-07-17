import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { CreatePlanRequest, PlatformPlan, UpdatePlanRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class AdminPlansService {
  private readonly api = inject(ApiService);

  private readonly _plans = signal<PlatformPlan[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selectedPlan = signal<PlatformPlan | null>(null);

  readonly plans = this._plans.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedPlan = this._selectedPlan.asReadonly();

  loadPlans(): void {
    this._loading.set(true);
    this._error.set(null);
    this.api.get<any>(API.ADMIN.PLANS_ROOT).subscribe({
      next: (res) => {
        this._plans.set(res.data ?? res);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar planes');
        this._loading.set(false);
      },
    });
  }

  loadPlan(uuid: string): void {
    this._loading.set(true);
    this._error.set(null);
    this.api.get<any>(API.ADMIN.PLANS_BY_ID(uuid)).subscribe({
      next: (res) => {
        this._selectedPlan.set(res.data ?? res);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar plan');
        this._loading.set(false);
      },
    });
  }

  createPlan(request: CreatePlanRequest): void {
    this.api.post<PlatformPlan>(API.ADMIN.PLANS_ROOT, request).subscribe({
      next: () => this.loadPlans(),
      error: (err) => this._error.set(err?.error?.message ?? 'Error al crear plan'),
    });
  }

  updatePlan(uuid: string, request: UpdatePlanRequest): void {
    this.api.patch<PlatformPlan>(API.ADMIN.PLANS_BY_ID(uuid), request).subscribe({
      next: () => {
        this.loadPlans();
        this.loadPlan(uuid);
      },
      error: (err) => this._error.set(err?.error?.message ?? 'Error al actualizar plan'),
    });
  }

  deactivatePlan(uuid: string): void {
    this.updatePlan(uuid, { isActive: false });
  }
}
