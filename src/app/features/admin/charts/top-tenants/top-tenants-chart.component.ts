import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { TopTenant } from '../../models';

@Component({
  selector: 'app-top-tenants-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 class="text-sm font-medium text-white">Top 10 colegios por ingreso</h3>
      <div class="mt-3">
        <canvas baseChart [type]="'bar'" [data]="chartData()" [options]="chartOptions()"></canvas>
      </div>
    </div>
  `,
})
export class TopTenantsChartComponent {
  readonly data = input<TopTenant[]>([]);

  protected readonly chartData = computed<ChartConfiguration<'bar'>['data']>(() => ({
    labels: this.data().map((d) => d.tenantName),
    datasets: [{
      label: 'Ingresos',
      data: this.data().map((d) => d.revenue),
      backgroundColor: '#818cf8',
      borderRadius: 4,
    }],
  }));

  protected readonly chartOptions = computed<ChartConfiguration<'bar'>['options']>(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: '#94a3b8', callback: (v) => 'S/ ' + v.toLocaleString('es-PE') },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
      },
      y: { ticks: { color: '#94a3b8' }, grid: { display: false } },
    },
  }));
}
