import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import {
  AdminTenantDetail,
  AdminTenantSummary,
  TenantFilterParams,
  TenantListResponse,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AdminTenantsService {
  private readonly api = inject(ApiService);

  private readonly _tenants = signal<AdminTenantSummary[]>([]);
  private readonly _totalElements = signal(0);
  private readonly _totalPages = signal(0);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selectedTenant = signal<AdminTenantDetail | null>(null);

  readonly tenants = this._tenants.asReadonly();
  readonly totalElements = this._totalElements.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedTenant = this._selectedTenant.asReadonly();

  loadTenants(params: TenantFilterParams = {}): void {
    this._loading.set(true);
    this._error.set(null);
    const query: any = {};
    if (params.search) query.search = params.search;
    if (params.plan) query.plan = params.plan;
    if (params.status) query.status = params.status;
    query.page = params.page ?? 0;
    query.size = params.size ?? 10;

    this.api.get<any>(API.ADMIN.TENANTS_ROOT, query).subscribe({
      next: (res) => {
        const data = res.data ?? res;
        this._tenants.set(data.content ?? data);
        this._totalElements.set(data.totalElements ?? 0);
        this._totalPages.set(data.totalPages ?? 0);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar instituciones');
        this._loading.set(false);
      },
    });
  }

  loadTenantDetail(uuid: string): void {
    this._loading.set(true);
    this._error.set(null);
    this.api.get<any>(API.ADMIN.TENANTS_BY_ID(uuid)).subscribe({
      next: (res) => {
        this._selectedTenant.set(res.data ?? res);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar detalle');
        this._loading.set(false);
      },
    });
  }

  suspendTenant(uuid: string): void {
    this.api.post<void>(API.ADMIN.TENANTS_SUSPEND(uuid), {}).subscribe({
      next: () => this.loadTenantDetail(uuid),
    });
  }

  reactivateTenant(uuid: string): void {
    this.api.post<void>(API.ADMIN.TENANTS_REACTIVATE(uuid), {}).subscribe({
      next: () => this.loadTenantDetail(uuid),
    });
  }

  assignPlan(tenantUuid: string, planUuid: string): void {
    this.api.post<void>(API.ADMIN.ASSIGN_SUBSCRIPTION(tenantUuid), {
      platformPlanUuid: planUuid,
    }).subscribe({
      next: () => this.loadTenantDetail(tenantUuid),
    });
  }
}
