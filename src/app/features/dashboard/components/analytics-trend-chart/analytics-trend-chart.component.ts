import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { AnalyticsChartPoint } from '../../services/analytics-api.service';

/**
 * Tenant-facing trend line chart (cierre-A / F10).
 *
 * <p>Renders a single line series on the values of
 * {@link AnalyticsChartPoint#value} and labels each point with the
 * {@code periodStart} date (short month/day, es-PE locale). The chart
 * uses {@code ng2-charts}/{@code chart.js} under the hood — the same
 * stack the existing admin charts
 * ({@code features/admin/charts/*}) are built on.</p>
 *
 * <p>Y-axis is fixed to {@code [0,1]} because the analytics endpoints
 * expose rates (ATTENDANCE_RATE, PERFORMANCE_AVG, MOROSIDAD) all in
 * the {@code [0..1]} range. The caller can pass a custom
 * {@link #unitSuffix} to annotate ticks (e.g. {@code "%"}).</p>
 */
@Component({
	selector: 'app-analytics-trend-chart',
	standalone: true,
	imports: [BaseChartDirective],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="rounded-xl border border-border bg-surface p-5 shadow-sm">
			<header class="mb-3">
				<h3 class="text-sm font-semibold text-content">{{ title() }}</h3>
				@if (subtitle()) {
					<p class="mt-0.5 text-xs text-content-muted">{{ subtitle() }}</p>
				}
			</header>
			@if (data().length === 0) {
				<div
					class="flex h-48 items-center justify-center text-sm text-content-muted"
					data-testid="analytics-trend-empty"
				>
					Sin datos en el período seleccionado.
				</div>
			} @else {
				<div class="h-48">
					<canvas
						baseChart
						[type]="'line'"
						[data]="chartData()"
						[options]="chartOptions()"
					></canvas>
				</div>
			}
		</div>
	`,
})
export class AnalyticsTrendChartComponent {
	readonly title = input.required<string>();
	readonly subtitle = input<string>('');
	readonly data = input.required<readonly AnalyticsChartPoint[]>();
	readonly color = input<string>('#6366f1');
	readonly unitSuffix = input<string>('%');

	protected readonly chartData = computed<ChartConfiguration<'line'>['data']>(() => {
		const points = this.data();
		const suffix = this.unitSuffix();
		return {
			labels: points.map((p) =>
				new Date(p.periodStart).toLocaleDateString('es-PE', {
					day: '2-digit',
					month: 'short',
				}),
			),
			datasets: [
				{
					label: this.title(),
					data: points.map((p) => p.value),
					borderColor: this.color(),
					backgroundColor: hexToRgba(this.color(), 0.12),
					fill: true,
					tension: 0.35,
					pointRadius: 3,
					pointHoverRadius: 5,
				},
			],
		};
	});

	protected readonly chartOptions = computed<ChartConfiguration<'line'>['options']>(() => {
		const suffix = this.unitSuffix();
		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: false } },
			scales: {
				x: {
					ticks: { color: '#64748b', font: { size: 10 } },
					grid: { display: false },
				},
				y: {
					min: 0,
					max: 1,
					ticks: {
						color: '#64748b',
						font: { size: 10 },
						callback: (v) => Math.round(Number(v) * 100) + suffix,
					},
					grid: { color: 'rgba(148, 163, 184, 0.15)' },
				},
			},
		};
	});
}

function hexToRgba(hex: string, alpha: number): string {
	const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
	if (!m) return `rgba(99, 102, 241, ${alpha})`;
	const n = parseInt(m[1], 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}