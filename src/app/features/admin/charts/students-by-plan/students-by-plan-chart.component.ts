import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { StudentsByPlanItem } from '../../models';

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];

@Component({
  selector: 'app-students-by-plan-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 class="text-sm font-medium text-white">Estudiantes por plan</h3>
      <div class="mt-3">
        <canvas baseChart [type]="'bar'" [data]="chartData()" [options]="chartOptions()"></canvas>
      </div>
    </div>
  `,
})
export class StudentsByPlanChartComponent {
  readonly data = input<StudentsByPlanItem[]>([]);

  protected readonly chartData = computed<ChartConfiguration<'bar'>['data']>(() => ({
    labels: this.data().map((d) => d.planName),
    datasets: [{
      label: 'Estudiantes',
      data: this.data().map((d) => d.count),
      backgroundColor: this.data().map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 4,
    }],
  }));

  protected readonly chartOptions = computed<ChartConfiguration<'bar'>['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
    },
  }));
}
