import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { AdminDashboardService } from '../../services';
import { KpiCardComponent } from '../../components';
import { RevenueTrendChartComponent } from '../../charts/revenue-trend';
import { ActiveTenantsChartComponent } from '../../charts/active-tenants';
import { PlanDistributionChartComponent } from '../../charts/plan-distribution';
import { TopTenantsChartComponent } from '../../charts/top-tenants';
import { CollectionVsOverdueChartComponent } from '../../charts/collection-vs-overdue';
import { StudentsByPlanChartComponent } from '../../charts/students-by-plan';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    KpiCardComponent,
    RevenueTrendChartComponent,
    ActiveTenantsChartComponent,
    PlanDistributionChartComponent,
    TopTenantsChartComponent,
    CollectionVsOverdueChartComponent,
    StudentsByPlanChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Dashboard</h1>
          <p class="mt-1 text-sm text-slate-400">Resumen global de la plataforma.</p>
        </div>
        <div class="flex items-center gap-3">
          @if (ds.dataTimestamp(); as ts) {
            <span class="text-xs text-slate-500">Datos al: {{ ts }}</span>
          }
          <button
            (click)="refresh()"
            [disabled]="ds.loading()"
            class="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            @if (ds.loading()) {
              <span class="inline-flex items-center gap-2">
                <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cargando…
              </span>
            } @else {
              Refrescar
            }
          </button>
        </div>
      </div>

      @if (ds.error(); as err) {
        <div class="mt-4 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{{ err }}</div>
      }

      @if (ds.kpis(); as kpis) {
        <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <app-kpi-card label="Ingresos del mes (MRR)" [value]="kpis.mrr" format="currency" subtitle="Ingreso mensual recurrente" />
          <app-kpi-card label="Colegios activos" [value]="kpis.activeTenants" subtitle="Tenants con plan activo" />
          <app-kpi-card label="Estudiantes activos" [value]="kpis.activeStudents" subtitle="Matriculados en secciones" />
          <app-kpi-card label="Por cobrar" [value]="kpis.totalReceivable" format="currency" subtitle="Facturas pendientes" />
        </div>
      }

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <app-revenue-trend-chart [data]="ds.revenueTrend()" />
        <app-active-tenants-chart [data]="ds.activeTenants()" />
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <app-plan-distribution-chart [data]="ds.planDistribution()" />
        <app-top-tenants-chart [data]="ds.topTenants()" />
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <app-collection-vs-overdue-chart [data]="ds.collectionVsOverdue()" />
        <app-students-by-plan-chart [data]="ds.studentsByPlan()" />
      </div>
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  protected readonly ds = inject(AdminDashboardService);

  ngOnInit(): void {
    this.ds.loadDashboard();
  }

  refresh(): void {
    this.ds.loadDashboard();
  }
}
