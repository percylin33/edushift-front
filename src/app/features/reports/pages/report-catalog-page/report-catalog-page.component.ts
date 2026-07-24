import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	computed,
	inject,
	signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
	BadgeColor,
	EmptyStateComponent,
	IconComponent,
	PageContainerComponent,
	PageHeaderComponent,
	SpinnerComponent,
} from '@shared/components';
import { ROUTES } from '@core/constants';
import { ReportJob } from '../../models/report.model';
import { ReportsApiService } from '../../services/reports-api.service';

/**
 * Sprint cierre-C / F12 — Report catalog page.
 *
 * <p>Lists every {@code report_jobs} row in the tenant (admin can see
 * what other users have generated). Each row shows the report type,
 * format, status, requested-by, when it ran, and a download link when
 * the job is {@code DONE}.</p>
 *
 * <p>The page doubles as the entry point for the future per-template
 * cron scheduler (cierre-C / B12). The catalog is the listing; the
 * scheduling UI lands on the same page when {@code report_templates}
 * + a cron field arrive in the BE.</p>
 */
@Component({
	selector: 'app-report-catalog-page',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		DatePipe,
		RouterLink,
		PageContainerComponent,
		PageHeaderComponent,
		IconComponent,
		EmptyStateComponent,
		SpinnerComponent,
	],
	template: `
		<app-page-container size="wide">
			<app-page-header
				eyebrow="Reportes"
				title="Catálogo de reportes"
				subtitle="Historial de reportes generados en este colegio."
			>
				<a [routerLink]="ROUTES.REPORTS.ROOT" class="btn btn-primary btn-sm">
					<app-icon name="plus" [size]="14" />
					<span>Generar reporte</span>
				</a>
				<button
					type="button"
					class="btn btn-outline btn-sm"
					(click)="reload()"
					[disabled]="loading()"
				>
					<app-icon name="rotate-cw" [size]="14" />
					<span>Actualizar</span>
				</button>
			</app-page-header>

			<div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-content-muted">
				<app-icon name="info" [size]="14" />
				<span>
					El scheduler de plantillas con cron + email está en construcción (cierre-C / B12).
					Acá ves el historial de los reportes que ya generaron los usuarios del colegio.
				</span>
			</div>

			@if (loading() && jobs().length === 0) {
				<div class="flex items-center justify-center py-16">
					<app-spinner [size]="24" label="Cargando catálogo…" />
				</div>
			} @else if (jobs().length === 0) {
				<app-empty-state
					icon="bar-chart"
					title="Aún no se generaron reportes"
					description="Usá el wizard para emitir el primer reporte del colegio."
				/>
			} @else {
				<div class="card overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-content-subtle">
								<tr>
									<th class="px-4 py-3 font-medium">Tipo</th>
									<th class="px-4 py-3 font-medium">Formato</th>
									<th class="px-4 py-3 font-medium">Estado</th>
									<th class="px-4 py-3 font-medium">Solicitado</th>
									<th class="px-4 py-3 font-medium">Finalizado</th>
									<th class="px-4 py-3 text-right font-medium">Acciones</th>
								</tr>
							</thead>
							<tbody>
								@for (job of jobs(); track job.publicUuid) {
									<tr class="border-b border-border last:border-b-0 hover:bg-surface-muted/40" data-testid="report-row">
										<td class="px-4 py-3">
											<div class="font-medium text-content">{{ reportTypeLabel(job.reportType) }}</div>
											@if (job.params) {
												<div class="font-mono text-xs text-content-muted truncate max-w-[260px]">{{ job.params }}</div>
											}
										</td>
										<td class="px-4 py-3 text-content-muted">{{ job.format }}</td>
										<td class="px-4 py-3">
											<span
												class="badge"
												[ngClass]="statusBadgeClass(job.status)"
												data-testid="report-status"
											>
												{{ statusLabel(job.status) }}
											</span>
										</td>
										<td class="px-4 py-3 text-xs text-content-muted">
											{{ job.requestedAt | date: 'short' }}
										</td>
										<td class="px-4 py-3 text-xs text-content-muted">
											{{ job.finishedAt ? (job.finishedAt | date: 'short') : '—' }}
										</td>
										<td class="px-4 py-3 text-right">
											@if (job.status === 'DONE') {
												<a
													class="btn btn-ghost btn-xs"
													[href]="downloadHref(job.publicUuid)"
													target="_blank"
													rel="noopener"
												>
													<app-icon name="download" [size]="12" />
													<span>Descargar</span>
												</a>
											}
										</td>
									</tr>
								}
							</tbody>
						</table>
					</div>
				</div>
			}

			<!-- Future: scheduler + template editor UI surface. -->
			<section class="card mt-6 border-dashed" aria-label="Próximamente">
				<header class="card-header">
					<h3 class="card-title text-sm">Plantillas programadas (próximamente)</h3>
				</header>
				<div class="card-body space-y-2 text-sm text-content-muted">
					<p>
						En el siguiente sprint (cierre-C / B12) vas a poder definir plantillas por
						tipo de reporte con:
					</p>
					<ul class="ml-5 list-disc space-y-1">
						<li>Expresión cron (ej. <code>0 8 1 * *</code> para el primer día del mes).</li>
						<li>Lista de destinatarios por email (rol o usuario específico).</li>
						<li>Formato de salida (PDF, XLSX, CSV) por plantilla.</li>
					</ul>
				</div>
			</section>
		</app-page-container>
	`,
})
export class ReportCatalogPageComponent implements OnInit {
	private readonly api = inject(ReportsApiService);

	protected readonly ROUTES = ROUTES;
	protected readonly loading = signal(false);
	protected readonly jobs = signal<readonly ReportJob[]>([]);

	async ngOnInit(): Promise<void> {
		await this.reload();
	}

	async reload(): Promise<void> {
		this.loading.set(true);
		try {
			const data = await firstValueFrom(this.api.list(0, 50));
			this.jobs.set(data ?? []);
		}
		catch (err: unknown) {
			if (err instanceof HttpErrorResponse) {
				console.warn('[report-catalog] reload failed', err.status, err.message);
			}
			this.jobs.set([]);
		}
		finally {
			this.loading.set(false);
		}
	}

	protected downloadHref(publicUuid: string): string {
		return this.api.downloadUrl(publicUuid);
	}

	protected reportTypeLabel(type: string | null | undefined): string {
		switch ((type ?? '').toUpperCase()) {
			case 'GRADE_BOOK': return 'Libreta de calificaciones';
			case 'ATTENDANCE_SUMMARY': return 'Resumen de asistencia';
			case 'PERIOD_CLOSE': return 'Cierre de periodo';
			case 'STUDENT_TRANSCRIPT': return 'Historial del estudiante';
			default: return type ?? '—';
		}
	}

	protected statusLabel(status: string | null | undefined): string {
		switch ((status ?? '').toUpperCase()) {
			case 'PENDING': return 'En cola';
			case 'RUNNING': return 'Generando';
			case 'DONE': return 'Listo';
			case 'FAILED': return 'Falló';
			case 'CANCELLED': return 'Cancelado';
			default: return status ?? '—';
		}
	}

	protected statusBadgeClass(status: string | null | undefined): BadgeColor {
		switch ((status ?? '').toUpperCase()) {
			case 'PENDING':
			case 'RUNNING':
				return 'badge-warning';
			case 'DONE':
				return 'badge-success';
			case 'FAILED':
				return 'badge-danger';
			case 'CANCELLED':
				return 'badge-muted';
			default:
				return 'badge-muted';
		}
	}
}