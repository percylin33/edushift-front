import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { CollectionVsOverdueItem } from '../../models';

@Component({
  selector: 'app-collection-vs-overdue-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-black/10">
      <div class="mb-1">
        <h2 class="text-sm font-semibold text-white">Facturas cobradas y vencidas</h2>
        <p class="mt-1 text-xs text-slate-400">Montos agrupados por mes de emisión y estado actual.</p>
      </div>
      @if (loading()) {
        <div role="status" class="mt-4 grid h-60 animate-pulse place-items-center rounded-lg bg-slate-800/50 text-xs text-slate-500">Cargando cobranza…</div>
      } @else if (failed()) {
        <div role="alert" class="mt-4 grid h-60 place-items-center rounded-lg border border-rose-500/15 bg-rose-950/20 px-4 text-center text-sm text-rose-200">No se pudo cargar la cobranza.</div>
      } @else if (!data().length) {
        <div class="mt-4 grid h-60 place-items-center rounded-lg border border-dashed border-slate-700 px-4 text-center text-sm text-slate-400">No hay facturas en este período.</div>
      } @else {
        <div class="mt-4 h-60">
          <canvas role="img" aria-label="Comparación de montos cobrados y vencidos por mes de emisión" baseChart [type]="'bar'" [data]="chartData()" [options]="chartOptions()"></canvas>
        </div>
      }
    </section>
  `,
})
export class CollectionVsOverdueChartComponent {
  readonly data = input<CollectionVsOverdueItem[]>([]);
  readonly loading = input(false);
  readonly failed = input(false);

  protected readonly chartData = computed<ChartConfiguration<'bar'>['data']>(() => ({
    labels: this.data().map((d) => d.month),
    datasets: [
      {
        label: 'Cobrado',
        data: this.data().map((d) => d.collected),
        backgroundColor: '#34d399',
        borderRadius: 4,
      },
      {
        label: 'Vencido',
        data: this.data().map((d) => d.overdue),
        backgroundColor: '#f87171',
        borderRadius: 4,
      },
    ],
  }));

  protected readonly chartOptions = computed<ChartConfiguration<'bar'>['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#94a3b8', padding: 12 },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: S/ ${Number(context.raw).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
      y: { stacked: true, beginAtZero: true, ticks: { color: '#94a3b8', callback: (v) => 'S/ ' + Number(v).toLocaleString('es-PE') }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
    },
  }));
}
