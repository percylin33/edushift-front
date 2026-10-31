import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { PlanDistributionItem } from '../../models';

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c'];

@Component({
  selector: 'app-plan-distribution-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-black/10">
      <div class="mb-1">
        <h2 class="text-sm font-semibold text-white">Instituciones por plan</h2>
        <p class="mt-1 text-xs text-slate-400">Distribución actual de las instituciones asignadas a cada plan.</p>
      </div>
      @if (loading()) {
        <div role="status" class="mt-4 grid h-64 animate-pulse place-items-center rounded-lg bg-slate-800/50 text-xs text-slate-500">Cargando distribución…</div>
      } @else if (failed()) {
        <div role="alert" class="mt-4 grid h-64 place-items-center rounded-lg border border-rose-500/15 bg-rose-950/20 px-4 text-center text-sm text-rose-200">No se pudo cargar la distribución.</div>
      } @else if (!data().length) {
        <div class="mt-4 grid h-64 place-items-center rounded-lg border border-dashed border-slate-700 px-4 text-center text-sm text-slate-400">No hay instituciones para mostrar.</div>
      } @else {
        <div class="mt-4 h-64">
          <canvas role="img" aria-label="Distribución de instituciones por plan" baseChart [type]="'doughnut'" [data]="chartData()" [options]="chartOptions()"></canvas>
        </div>
      }
    </section>
  `,
})
export class PlanDistributionChartComponent {
  readonly data = input<PlanDistributionItem[]>([]);
  readonly loading = input(false);
  readonly failed = input(false);

  protected readonly chartData = computed<ChartConfiguration<'doughnut'>['data']>(() => ({
    labels: this.data().map((d) => d.planName),
    datasets: [{
      data: this.data().map((d) => d.count),
      backgroundColor: this.data().map((_, i) => COLORS[i % COLORS.length]),
    }],
  }));

  protected readonly chartOptions = computed<ChartConfiguration<'doughnut'>['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', padding: 12 },
      },
    },
  }));
}
