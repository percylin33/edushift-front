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
    <div class="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 class="text-sm font-medium text-white">Ingresos mensuales</h3>
      <div class="mt-3">
        <canvas baseChart [type]="'line'" [data]="chartData()" [options]="chartOptions()"></canvas>
      </div>
    </div>
  `,
})
export class RevenueTrendChartComponent {
  readonly data = input<RevenueTrendPoint[]>([]);

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
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
      y: { ticks: { color: '#94a3b8', callback: (v) => 'S/ ' + v.toLocaleString('es-PE') }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
    },
  }));
}
