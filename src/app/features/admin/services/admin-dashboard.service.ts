import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import {
  ActiveTenantsPoint,
  CollectionVsOverdueItem,
  DashboardKpis,
  PlanDistributionItem,
  RevenueTrendPoint,
  StudentsByPlanItem,
  TopTenant,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly api = inject(ApiService);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly dataTimestamp = signal<string | null>(null);

  triggerRefresh(): void {
    this.loadDashboard();
  }

  private readonly kpisData = signal<DashboardKpis | null>(null);
  private readonly revenueTrendData = signal<RevenueTrendPoint[]>([]);
  private readonly activeTenantsData = signal<ActiveTenantsPoint[]>([]);
  private readonly planDistributionData = signal<PlanDistributionItem[]>([]);
  private readonly topTenantsData = signal<TopTenant[]>([]);
  private readonly collectionVsOverdueData = signal<CollectionVsOverdueItem[]>([]);
  private readonly studentsByPlanData = signal<StudentsByPlanItem[]>([]);

  readonly kpis = this.kpisData.asReadonly();
  readonly revenueTrend = this.revenueTrendData.asReadonly();
  readonly activeTenants = this.activeTenantsData.asReadonly();
  readonly planDistribution = this.planDistributionData.asReadonly();
  readonly topTenants = this.topTenantsData.asReadonly();
  readonly collectionVsOverdue = this.collectionVsOverdueData.asReadonly();
  readonly studentsByPlan = this.studentsByPlanData.asReadonly();

  loadDashboard(): void {
    this._loading.set(true);
    this._error.set(null);
    const now = new Date();
    this.dataTimestamp.set(now.toLocaleString('es-PE'));

    this.api.get<any>(API.ADMIN.KPIS).subscribe({
      next: (res) => {
        const d = res.data ?? res;
        this.kpisData.set({
          mrr: d.mrr ?? 0,
          activeTenants: d.activeTenants ?? 0,
          activeStudents: d.activeStudents ?? 0,
          totalReceivable: d.totalReceivable ?? 0,
        });
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar KPIs');
        this._loading.set(false);
      },
    });

    this.loadChart(API.ADMIN.REVENUE_TREND, this.revenueTrendData);
    this.loadChart(API.ADMIN.ACTIVE_TENANTS, this.activeTenantsData);
    this.loadChart(API.ADMIN.PLAN_DISTRIBUTION, this.planDistributionData);
    this.loadChart(API.ADMIN.TOP_TENANTS, this.topTenantsData);
    this.loadChart(API.ADMIN.COLLECTION_VS_OVERDUE, this.collectionVsOverdueData);
    this.loadChart(API.ADMIN.STUDENTS_BY_PLAN, this.studentsByPlanData);
  }

  private loadChart<T>(url: string, target: ReturnType<typeof signal<T[]>>): void {
    this.api.get<any>(url).subscribe({
      next: (res) => target.set((res.data ?? res) as T[]),
      error: () => target.set([]),
    });
  }
}
