import { Injectable, inject, signal, WritableSignal } from '@angular/core';
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
        const d = (res.data ?? res) as Record<string, unknown>;
        this.kpisData.set({
          mrr: this.money(d, 'mrrCents', 'mrr'),
          activeTenants: this.number(d['activeTenants']),
          activeStudents: this.number(d['activeStudents']),
          totalReceivable: this.money(d, 'overdueCents', 'totalReceivable'),
        });
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar KPIs');
        this._loading.set(false);
      },
    });

    this.loadChart(API.ADMIN.REVENUE_TREND, this.revenueTrendData, (payload) =>
      this.asRows(payload).map((row) => ({
        month: this.monthLabel(row['month']),
        revenue: this.number(row['collected']) / 100,
      })),
    );
    this.loadChart(API.ADMIN.ACTIVE_TENANTS, this.activeTenantsData, (payload) =>
      this.asRows(payload).map((row) => ({
        month: this.monthLabel(row['month']),
        count: this.number(row['count']),
      })),
    );
    this.loadChart(API.ADMIN.PLAN_DISTRIBUTION, this.planDistributionData, (payload) =>
      this.asPlanItems(payload),
    );
    this.loadChart(API.ADMIN.TOP_TENANTS, this.topTenantsData, (payload) =>
      this.asRows(payload).map((row) => ({
        tenantName: String(row['name'] ?? row['tenantName'] ?? ''),
        revenue: this.money(row, 'revenueCents', 'revenue'),
      })),
    );
    this.loadChart(API.ADMIN.COLLECTION_VS_OVERDUE, this.collectionVsOverdueData, (payload) =>
      this.asRows(payload).map((row) => ({
        month: this.monthLabel(row['month']),
        collected: this.number(row['collected']) / 100,
        overdue: this.number(row['overdue']) / 100,
      })),
    );
    this.loadChart(API.ADMIN.STUDENTS_BY_PLAN, this.studentsByPlanData, (payload) =>
      this.asPlanItems(payload),
    );
  }

  private loadChart<T>(
    url: string,
    target: WritableSignal<T[]>,
    mapRows: (payload: unknown) => T[],
  ): void {
    this.api.get<any>(url).subscribe({
      next: (res) => target.set(mapRows(res?.data ?? res)),
      error: () => target.set([]),
    });
  }

  /** Plan charts arrive as `{ labels, values }`, not as a row list. */
  private asPlanItems(payload: unknown): { planName: string; count: number }[] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return [];
    }
    const body = payload as { labels?: unknown; values?: unknown };
    const labels = Array.isArray(body.labels) ? body.labels : [];
    const values = Array.isArray(body.values) ? body.values : [];
    return labels.map((label, index) => ({
      planName: String(label),
      count: this.number(values[index]),
    }));
  }

  private asRows(payload: unknown): Record<string, unknown>[] {
    if (!Array.isArray(payload)) {
      return [];
    }
    return payload.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
  }

  private monthLabel(value: unknown): string {
    const raw = String(value ?? '');
    return raw.length >= 7 ? raw.slice(0, 7) : raw;
  }

  /** Prefer cent fields from the API; fall back to an already-scaled amount. */
  private money(row: Record<string, unknown>, centsKey: string, unitKey: string): number {
    if (row[centsKey] != null) {
      return this.number(row[centsKey]) / 100;
    }
    return this.number(row[unitKey]);
  }

  private number(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
}
