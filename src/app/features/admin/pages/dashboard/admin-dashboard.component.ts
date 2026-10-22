import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminDashboardService } from '../../services';
import { KpiCardComponent } from '../../components';
import { RevenueTrendChartComponent } from '../../charts/revenue-trend';
import { NewInstitutionsChartComponent } from '../../charts/new-institutions';
import { PlanDistributionChartComponent } from '../../charts/plan-distribution';
import { TopTenantsChartComponent } from '../../charts/top-tenants';
import { CollectionVsOverdueChartComponent } from '../../charts/collection-vs-overdue';
import { StudentsByPlanChartComponent } from '../../charts/students-by-plan';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    KpiCardComponent,
    RevenueTrendChartComponent,
    NewInstitutionsChartComponent,
    PlanDistributionChartComponent,
    TopTenantsChartComponent,
    CollectionVsOverdueChartComponent,
    StudentsByPlanChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto w-full max-w-[1600px] p-4 sm:p-6 xl:p-8">
      <header class="flex flex-col gap-4 border-b border-slate-800 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
            <span class="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">Control maestro</span>
          </div>
          <p class="mt-1 max-w-xl text-sm text-slate-400">Resumen global de instituciones, facturación y actividad de EduShift.</p>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          @if (ds.dataTimestamp(); as timestamp) {
            <div class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs text-slate-300">
              <svg aria-hidden="true" class="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="9" /><path stroke-linecap="round" d="M12 7v5l3 2" />
              </svg>
              <span>Datos al {{ timestamp }}</span>
            </div>
          }
          <label class="sr-only" for="dashboard-period">Período de tendencias</label>
          <select
            id="dashboard-period"
            [value]="periodMonths()"
            (change)="changePeriod($event)"
            class="min-h-10 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          >
            <option value="6">Últimos 6 meses</option>
            <option value="12">Últimos 12 meses</option>
          </select>
          <button
            type="button"
            (click)="refresh()"
            [disabled]="ds.loading()"
            class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition-colors hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
          >
            <svg aria-hidden="true" class="h-4 w-4" [class.animate-spin]="ds.loading()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 7v5h-5M4 17v-5h5m11-1a8 8 0 0 0-14.8-3M4 13a8 8 0 0 0 14.8 3" />
            </svg>
            {{ ds.loading() ? 'Actualizando…' : 'Refrescar datos' }}
          </button>
        </div>
      </header>

      @if (ds.loadingPanels().kpis && !ds.kpis()) {
        <div aria-label="Cargando indicadores" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (placeholder of [1, 2, 3, 4]; track placeholder) {
            <div class="h-36 animate-pulse rounded-xl border border-slate-800 bg-slate-900/80"></div>
          }
        </div>
      } @else if (ds.failedPanels().kpis && !ds.kpis()) {
        <div role="alert" class="mt-6 flex flex-col gap-3 rounded-xl border border-rose-500/20 bg-rose-950/30 p-4 text-sm text-rose-200 sm:flex-row sm:items-center sm:justify-between">
          <span>No se pudieron cargar los indicadores principales.</span>
          <button type="button" (click)="refresh()" class="self-start rounded-lg border border-rose-400/20 px-3 py-2 font-medium hover:bg-rose-400/10 sm:self-auto">Reintentar</button>
        </div>
      } @else {
        @if (ds.kpis(); as kpis) {
          @if (ds.failedPanels().kpis) {
            <p role="status" class="mt-4 text-xs text-amber-300">No se pudieron actualizar los indicadores; se muestran los últimos datos disponibles.</p>
          }
          <section aria-label="Indicadores principales" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <app-kpi-card label="MRR estimado" [value]="kpis.mrr" format="currency" subtitle="Suscripciones activas × estudiantes matriculados × precio vigente" />
            <app-kpi-card label="Instituciones activas" [value]="kpis.activeTenants" subtitle="Estado de institución: activa" />
            <app-kpi-card label="Estudiantes activos" [value]="kpis.activeStudents" subtitle="Matriculados en instituciones activas" />
            <app-kpi-card label="Por cobrar" [value]="kpis.totalReceivable" format="currency" subtitle="Facturas pendientes o vencidas" [detail]="'Vencido: ' + formatCurrency(kpis.overdue)" />
          </section>

          <section aria-label="Cobranza del mes" class="mt-4 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-sm text-slate-300">Cobrado este mes <strong class="ml-1 text-emerald-300">{{ formatCurrency(kpis.collectedThisMonth) }}</strong></p>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p class="text-xs text-slate-400">Cobranza de facturas emitidas este mes: <strong class="text-slate-200">{{ formatPercent(kpis.collectionRate) }}</strong></p>
              <a routerLink="/admin/invoices" class="text-xs font-medium text-indigo-300 hover:text-indigo-200">Revisar facturas <span aria-hidden="true">→</span></a>
            </div>
          </section>
        }
      }

      <section aria-label="Tendencias" class="mt-6 grid gap-4 xl:grid-cols-5">
        <app-revenue-trend-chart class="xl:col-span-3" [data]="ds.revenueTrend()" [loading]="ds.loadingPanels().revenueTrend" [failed]="ds.failedPanels().revenueTrend" />
        <app-new-institutions-chart class="xl:col-span-2" [data]="ds.newInstitutions()" [loading]="ds.loadingPanels().newInstitutions" [failed]="ds.failedPanels().newInstitutions" />
      </section>

      <section aria-label="Instituciones y planes" class="mt-4 grid gap-4 xl:grid-cols-5">
        <app-plan-distribution-chart class="xl:col-span-2" [data]="ds.planDistribution()" [loading]="ds.loadingPanels().planDistribution" [failed]="ds.failedPanels().planDistribution" />
        <app-top-tenants-chart class="xl:col-span-3" [data]="ds.topTenants()" [loading]="ds.loadingPanels().topTenants" [failed]="ds.failedPanels().topTenants" />
      </section>

      <section aria-label="Cobranza y matrícula" class="mt-4 grid gap-4 xl:grid-cols-2">
        <app-collection-vs-overdue-chart [data]="ds.collectionVsOverdue()" [loading]="ds.loadingPanels().collectionVsOverdue" [failed]="ds.failedPanels().collectionVsOverdue" />
        <app-students-by-plan-chart [data]="ds.studentsByPlan()" [loading]="ds.loadingPanels().studentsByPlan" [failed]="ds.failedPanels().studentsByPlan" />
      </section>

      <footer class="mt-6 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>Datos agregados de la plataforma EduShift</span>
        <a [routerLink]="'/admin/tenants'" class="font-medium text-indigo-300 hover:text-indigo-200">Ir a instituciones <span aria-hidden="true">→</span></a>
      </footer>
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  protected readonly ds = inject(AdminDashboardService);
  readonly periodMonths = signal<6 | 12>(12);

  ngOnInit(): void {
    this.ds.loadDashboard(this.periodMonths());
  }

  changePeriod(event: Event): void {
    const selectedValue = Number((event.target as HTMLSelectElement).value);
    this.periodMonths.set(selectedValue === 6 ? 6 : 12);
    this.ds.loadDashboard(this.periodMonths());
  }

  refresh(): void {
    this.ds.loadDashboard(this.periodMonths());
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
  }

  formatPercent(value: number): string {
    return new Intl.NumberFormat('es-PE', { style: 'percent', maximumFractionDigits: 1 }).format(value);
  }
}
