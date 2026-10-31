import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { RevenueTrendPoint } from '../../models';

@Component({
  selector: 'app-revenue-trend-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-black/10">
      <div class="mb-1">
        <h2 class="text-sm font-semibold text-white">Cobrado por mes de emisión</h2>
        <p class="mt-1 text-xs text-slate-400">Facturas no eliminadas, agrupadas por fecha de emisión y estado actual.</p>
      </div>
      @if (loading()) {
        <div role="status" class="mt-4 grid h-56 animate-pulse place-items-center rounded-lg bg-slate-800/50 text-xs text-slate-500">Cargando tendencia…</div>
      } @else if (failed()) {
        <div role="alert" class="mt-4 grid h-56 place-items-center rounded-lg border border-rose-500/15 bg-rose-950/20 px-4 text-center text-sm text-rose-200">No se pudo cargar esta tendencia.</div>
      } @else if (!data().length) {
        <div class="mt-4 grid h-56 place-items-center rounded-lg border border-dashed border-slate-700 px-4 text-center text-sm text-slate-400">Aún no hay facturas en este período.</div>
      } @else {
        <div class="mt-4 h-56">
          <canvas role="img" aria-label="Gráfica del monto cobrado por mes de emisión" baseChart [type]="'line'" [data]="chartData()" [options]="chartOptions()"></canvas>
        </div>
      }
    </section>
  `,
})
export class RevenueTrendChartComponent {
  readonly data = input<RevenueTrendPoint[]>([]);
  readonly loading = input(false);
  readonly failed = input(false);

  protected readonly chartData = computed<ChartConfiguration<'line'>['data']>(() => ({
    labels: this.data().map((d) => d.month),
    datasets: [{
      label: 'Ingresos',
      data: this.data().map((d) => d.revenue),
      borderColor: '#818cf8',
      backgroundColor: 'rgba(129, 140, 248, 0.1)',
      fill: true,
      tension: 0.4,
    }],
  }));

  protected readonly chartOptions = computed<ChartConfiguration<'line'>['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `Cobrado: S/ ${Number(context.raw).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
      y: { beginAtZero: true, ticks: { color: '#94a3b8', callback: (v) => 'S/ ' + Number(v).toLocaleString('es-PE') }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
    },
  }));
}
