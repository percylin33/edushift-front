import { Injectable, computed, inject, signal, WritableSignal } from '@angular/core';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import {
  CollectionVsOverdueItem,
  DashboardKpis,
  NewInstitutionsPoint,
  PlanDistributionItem,
  RevenueTrendPoint,
  StudentsByPlanItem,
  TopTenant,
} from '../models';

type DashboardPanel =
  | 'kpis'
  | 'revenueTrend'
  | 'newInstitutions'
  | 'planDistribution'
  | 'topTenants'
  | 'collectionVsOverdue'
  | 'studentsByPlan';

type DashboardPanelState = Record<DashboardPanel, boolean>;

interface DashboardKpiResponse {
  mrrCents: number;
  activeTenants: number;
  activeStudents: number;
  overdueCents: number;
  receivableCents: number;
  collectedThisMonthCents: number;
  collectionRate: number;
  lastUpdated: string;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly api = inject(ApiService);
  private readonly panelKeys: DashboardPanel[] = [
    'kpis',
    'revenueTrend',
    'newInstitutions',
    'planDistribution',
    'topTenants',
    'collectionVsOverdue',
    'studentsByPlan',
  ];
  private requestSequence = 0;

  private readonly _loadingPanels = signal<DashboardPanelState>(this.panelState(true));
  private readonly _failedPanels = signal<DashboardPanelState>(this.panelState(false));
  readonly loadingPanels = this._loadingPanels.asReadonly();
  readonly failedPanels = this._failedPanels.asReadonly();
  readonly loading = computed(() => Object.values(this._loadingPanels()).some(Boolean));
  readonly error = computed(() => this._failedPanels().kpis ? 'No se pudieron cargar los indicadores.' : null);
  readonly dataTimestamp = signal<string | null>(null);

  private readonly kpisData = signal<DashboardKpis | null>(null);
  private readonly revenueTrendData = signal<RevenueTrendPoint[]>([]);
  private readonly newInstitutionsData = signal<NewInstitutionsPoint[]>([]);
  private readonly planDistributionData = signal<PlanDistributionItem[]>([]);
  private readonly topTenantsData = signal<TopTenant[]>([]);
  private readonly collectionVsOverdueData = signal<CollectionVsOverdueItem[]>([]);
  private readonly studentsByPlanData = signal<StudentsByPlanItem[]>([]);

  readonly kpis = this.kpisData.asReadonly();
  readonly revenueTrend = this.revenueTrendData.asReadonly();
  readonly newInstitutions = this.newInstitutionsData.asReadonly();
  readonly planDistribution = this.planDistributionData.asReadonly();
  readonly topTenants = this.topTenantsData.asReadonly();
  readonly collectionVsOverdue = this.collectionVsOverdueData.asReadonly();
  readonly studentsByPlan = this.studentsByPlanData.asReadonly();

  loadDashboard(months = 12): void {
    const requestSequence = ++this.requestSequence;
    this._loadingPanels.set(this.panelState(true));
    this._failedPanels.set(this.panelState(false));

    this.api.get<ApiResponse<DashboardKpiResponse>>(API.ADMIN.KPIS).subscribe({
      next: (response) => {
        if (requestSequence !== this.requestSequence) return;
        const data = response.data;
        this.kpisData.set({
          mrr: this.money(data.mrrCents),
          activeTenants: this.number(data.activeTenants),
          activeStudents: this.number(data.activeStudents),
          totalReceivable: this.money(data.receivableCents),
          overdue: this.money(data.overdueCents),
          collectedThisMonth: this.money(data.collectedThisMonthCents),
          collectionRate: this.number(data.collectionRate),
        });
        this.dataTimestamp.set(this.formatTimestamp(data.lastUpdated));
        this.finishPanel('kpis', false);
      },
      error: () => {
        if (requestSequence !== this.requestSequence) return;
        this.finishPanel('kpis', true);
      },
    });

    this.loadChart(requestSequence, 'revenueTrend', API.ADMIN.REVENUE_TREND, this.revenueTrendData, (payload) =>
      this.asRows(payload).map((row) => ({
        month: this.monthLabel(row['month']),
        revenue: this.money(row['collected']),
      })), { months });

    this.loadChart(requestSequence, 'newInstitutions', API.ADMIN.ACTIVE_TENANTS, this.newInstitutionsData, (payload) =>
      this.asRows(payload).map((row) => ({
        month: this.monthLabel(row['month']),
        count: this.number(row['count']),
      })), { months });

    this.loadChart(requestSequence, 'planDistribution', API.ADMIN.PLAN_DISTRIBUTION, this.planDistributionData,
      (payload) => this.asPlanItems(payload));

    this.loadChart(requestSequence, 'topTenants', API.ADMIN.TOP_TENANTS, this.topTenantsData, (payload) =>
      this.asRows(payload).map((row) => ({
        tenantName: String(row['name'] ?? row['tenantName'] ?? ''),
        publicUuid: String(row['publicUuid'] ?? row['public_uuid'] ?? ''),
        revenue: this.money(row['revenueCents'] ?? row['revenue']),
      })));

    this.loadChart(requestSequence, 'collectionVsOverdue', API.ADMIN.COLLECTION_VS_OVERDUE,
      this.collectionVsOverdueData, (payload) => this.asRows(payload).map((row) => ({
        month: this.monthLabel(row['month']),
        collected: this.money(row['collected']),
        overdue: this.money(row['overdue']),
      })), { months });

    this.loadChart(requestSequence, 'studentsByPlan', API.ADMIN.STUDENTS_BY_PLAN, this.studentsByPlanData,
      (payload) => this.asPlanItems(payload));
  }

  private loadChart<T>(
    requestSequence: number,
    panel: Exclude<DashboardPanel, 'kpis'>,
    url: string,
    target: WritableSignal<T[]>,
    mapRows: (payload: unknown) => T[],
    params?: Record<string, number>,
  ): void {
    this.api.get<ApiResponse<unknown>>(url, params).subscribe({
      next: (response) => {
        if (requestSequence !== this.requestSequence) return;
        target.set(mapRows(response.data));
        this.finishPanel(panel, false);
      },
      error: () => {
        if (requestSequence !== this.requestSequence) return;
        target.set([]);
        this.finishPanel(panel, true);
      },
    });
  }

  private finishPanel(panel: DashboardPanel, failed: boolean): void {
    this._loadingPanels.update((state) => ({ ...state, [panel]: false }));
    this._failedPanels.update((state) => ({ ...state, [panel]: failed }));
  }

  private panelState(value: boolean): DashboardPanelState {
    return Object.fromEntries(this.panelKeys.map((key) => [key, value])) as DashboardPanelState;
  }

  /** Plan endpoints return `{ labels, values }`, not a row list. */
  private asPlanItems(payload: unknown): PlanDistributionItem[] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
    const body = payload as { labels?: unknown; values?: unknown };
    const labels = Array.isArray(body.labels) ? body.labels : [];
    const values = Array.isArray(body.values) ? body.values : [];
    return labels.map((label, index) => ({
      planName: String(label),
      count: this.number(values[index]),
    }));
  }

  private asRows(payload: unknown): Record<string, unknown>[] {
    if (!Array.isArray(payload)) return [];
    return payload.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
  }

  private monthLabel(value: unknown): string {
    const raw = String(value ?? '');
    const match = /^(\d{4})-(\d{2})/.exec(raw);
    if (!match) return raw;
    const monthDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
    return new Intl.DateTimeFormat('es-PE', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(monthDate);
  }

  private formatTimestamp(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Lima',
    }).format(date);
  }

  private money(value: unknown): number {
    return this.number(value) / 100;
  }

  private number(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }
}
