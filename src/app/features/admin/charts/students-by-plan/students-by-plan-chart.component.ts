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
    <section class="h-full rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-black/10">
      <div class="mb-1">
        <h2 class="text-sm font-semibold text-white">Estudiantes por plan</h2>
        <p class="mt-1 text-xs text-slate-400">Matrículas activas en las instituciones asignadas a cada plan.</p>
      </div>
      @if (loading()) {
        <div role="status" class="mt-4 grid h-60 animate-pulse place-items-center rounded-lg bg-slate-800/50 text-xs text-slate-500">Cargando estudiantes…</div>
      } @else if (failed()) {
        <div role="alert" class="mt-4 grid h-60 place-items-center rounded-lg border border-rose-500/15 bg-rose-950/20 px-4 text-center text-sm text-rose-200">No se pudo cargar el desglose.</div>
      } @else if (!data().length) {
        <div class="mt-4 grid h-60 place-items-center rounded-lg border border-dashed border-slate-700 px-4 text-center text-sm text-slate-400">No hay matrículas que mostrar.</div>
      } @else {
        <div class="mt-4 h-60">
          <canvas role="img" aria-label="Estudiantes matriculados por plan" baseChart [type]="'bar'" [data]="chartData()" [options]="chartOptions()"></canvas>
        </div>
      }
    </section>
  `,
})
export class StudentsByPlanChartComponent {
  readonly data = input<StudentsByPlanItem[]>([]);
  readonly loading = input(false);
  readonly failed = input(false);

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
