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
    <div class="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 class="text-sm font-medium text-white">Cobrado vs vencido</h3>
      <div class="mt-3">
        <canvas baseChart [type]="'bar'" [data]="chartData()" [options]="chartOptions()"></canvas>
      </div>
    </div>
  `,
})
export class CollectionVsOverdueChartComponent {
  readonly data = input<CollectionVsOverdueItem[]>([]);

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
    },
    scales: {
      x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
      y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
    },
  }));
}
