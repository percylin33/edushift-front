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
    <div class="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 class="text-sm font-medium text-white">Distribución de planes</h3>
      <div class="mt-3">
        <canvas baseChart [type]="'doughnut'" [data]="chartData()" [options]="chartOptions()"></canvas>
      </div>
    </div>
  `,
})
export class PlanDistributionChartComponent {
  readonly data = input<PlanDistributionItem[]>([]);

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
