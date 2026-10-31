import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
	inject,
	signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
	FormBuilder,
	FormControl,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
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
import {
	ReportTemplate,
	ReportTemplateRequest,
	ReportTemplatesApiService,
} from '../../services/report-templates-api.service';

/**
 * Sprint cierre-C / F12 + B12 — Report catalog + scheduled templates
 * admin page.
 *
 * <h3>Tabs</h3>
 * <ul>
 *   <li><b>Historial</b> — every {@code report_jobs} row in the tenant
 *       (ad-hoc + template-triggered), with download link when the
 *       job is DONE.</li>
 *   <li><b>Plantillas programadas</b> — CRUD on
 *       {@code report_templates}: name + cron + timezone + recipients +
 *       format. The BE's {@code ReportTemplateRunner} ticks once per
 *       minute and dispatches a job whenever the cron fires; the
 *       runner emails the output when SMTP is configured.</li>
 * </ul>
 *
 * <p>The cron field is a plain text input with a quick-pick preset row
 * (every minute / hour / day / first-of-month / Mondays at 08:00) so
 * admins don't have to memorise the 6-field Spring format.</p>
 */
@Component({
	selector: 'app-report-catalog-page',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		DatePipe,
		RouterLink,
		ReactiveFormsModule,
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
				subtitle="Historial y plantillas programadas para este colegio."
			>
				<a [routerLink]="ROUTES.REPORTS.ROOT" class="btn btn-primary btn-sm">
					<app-icon name="plus" [size]="14" />
					<span>Generar reporte</span>
				</a>
				<button
					type="button"
					class="btn btn-outline btn-sm"
					(click)="reloadAll()"
					[disabled]="loading()"
				>
					<app-icon name="rotate-cw" [size]="14" />
					<span>Actualizar</span>
				</button>
			</app-page-header>

			<!-- Tabs -->
			<nav class="mb-4 flex border-b border-border" role="tablist">
				<button
					type="button"
					role="tab"
					class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
					[ngClass]="activeTab() === 'jobs' ? 'border-primary text-content' : 'border-transparent text-content-muted hover:text-content'"
					(click)="activeTab.set('jobs')"
					data-testid="tab-jobs"
				>
					Historial
					<span class="ml-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs">{{ jobs().length }}</span>
				</button>
				<button
					type="button"
					role="tab"
					class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
					[ngClass]="activeTab() === 'templates' ? 'border-primary text-content' : 'border-transparent text-content-muted hover:text-content'"
					(click)="activeTab.set('templates')"
					data-testid="tab-templates"
				>
					Plantillas programadas
					<span class="ml-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs">{{ templates().length }}</span>
				</button>
			</nav>

			@if (activeTab() === 'jobs') {
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
										<th class="px-4 py-3 font-medium">Origen</th>
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
												<span class="badge" [ngClass]="statusBadgeClass(job.status)">
													{{ statusLabel(job.status) }}
												</span>
											</td>
											<td class="px-4 py-3">
												@if (job.triggeredByTemplate) {
													<span class="badge badge-info" data-testid="report-from-template">Plantilla</span>
												} @else {
													<span class="text-content-subtle">Ad-hoc</span>
												}
											</td>
											<td class="px-4 py-3 text-xs text-content-muted">
												{{ job.requestedAt | date: 'short' }}
											</td>
											<td class="px-4 py-3 text-xs text-content-muted">
												{{ job.finishedAt ? (job.finishedAt | date: 'short') : '—' }}
											</td>
											<td class="px-4 py-3 text-right">
												@if (job.status === 'DONE') {
													<a class="btn btn-ghost btn-xs" [href]="downloadHref(job.publicUuid)" target="_blank" rel="noopener">
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
			} @else {
				<!-- Templates tab -->
				@if (loading() && templates().length === 0) {
					<div class="flex items-center justify-center py-16">
						<app-spinner [size]="24" label="Cargando plantillas…" />
					</div>
				} @else if (templates().length === 0) {
					<app-empty-state
						icon="calendar-clock"
						title="Sin plantillas programadas"
						description="Creá una plantilla con cron + email para automatizar reportes recurrentes."
					/>
				} @else {
					<div class="card overflow-hidden">
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead class="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-content-subtle">
									<tr>
										<th class="px-4 py-3 font-medium">Nombre</th>
										<th class="px-4 py-3 font-medium">Tipo</th>
										<th class="px-4 py-3 font-medium">Formato</th>
										<th class="px-4 py-3 font-medium">Cron</th>
										<th class="px-4 py-3 font-medium">Próxima</th>
										<th class="px-4 py-3 font-medium">Última</th>
										<th class="px-4 py-3 font-medium">Activo</th>
										<th class="px-4 py-3 text-right font-medium">Acciones</th>
									</tr>
								</thead>
								<tbody>
									@for (t of templates(); track t.publicUuid) {
										<tr class="border-b border-border last:border-b-0 hover:bg-surface-muted/40" data-testid="template-row">
											<td class="px-4 py-3">
												<div class="font-medium text-content">{{ t.name }}</div>
												@if (t.description) {
													<div class="text-xs text-content-muted truncate max-w-[260px]">{{ t.description }}</div>
												}
											</td>
											<td class="px-4 py-3 text-content-muted">{{ reportTypeLabel(t.reportType) }}</td>
											<td class="px-4 py-3 text-content-muted">{{ t.format }}</td>
											<td class="px-4 py-3 font-mono text-xs text-content">{{ t.cronExpression }} ({{ t.timezone }})</td>
											<td class="px-4 py-3 text-xs text-content-muted">{{ t.nextRunAt ? (t.nextRunAt | date: 'short') : '—' }}</td>
											<td class="px-4 py-3 text-xs text-content-muted">{{ t.lastRunAt ? (t.lastRunAt | date: 'short') : '—' }}</td>
											<td class="px-4 py-3">
												@if (t.active) {
													<span class="badge badge-success">Sí</span>
												} @else {
													<span class="badge badge-muted">No</span>
												}
											</td>
											<td class="px-4 py-3 text-right">
												<button type="button" class="btn btn-ghost btn-xs" (click)="openTemplateEdit(t)" [attr.data-testid]="'template-edit-' + t.publicUuid">
													<app-icon name="pencil" [size]="12" />
													<span>Editar</span>
												</button>
												<button type="button" class="btn btn-ghost btn-xs text-danger" (click)="confirmTemplateDelete(t)" [attr.data-testid]="'template-delete-' + t.publicUuid">
													<app-icon name="trash-2" [size]="12" />
													<span>Eliminar</span>
												</button>
											</td>
										</tr>
									}
								</tbody>
							</table>
						</div>
					</div>
				}

				<!-- Templates CRUD drawer -->
				@if (editingTemplate(); as draft) {
					<div class="card mt-6" data-testid="template-form">
						<header class="card-header flex items-center justify-between">
							<h2 class="card-title">{{ draft.existing ? 'Editar plantilla' : 'Nueva plantilla' }}</h2>
							<button type="button" class="btn btn-ghost btn-sm" (click)="cancelTemplateEdit()">
								<app-icon name="x" [size]="14" />
							</button>
						</header>

						<form [formGroup]="templateForm" (ngSubmit)="submitTemplate()" class="card-body grid gap-4 sm:grid-cols-2">
							<div class="field sm:col-span-2">
								<label class="label">Nombre *</label>
								<input type="text" class="input" formControlName="name" maxlength="120" />
							</div>

							<div class="field">
								<label class="label">Tipo de reporte *</label>
								<select class="select" formControlName="reportType">
									@for (opt of REPORT_TYPE_OPTIONS; track opt.value) {
										<option [value]="opt.value">{{ opt.label }}</option>
									}
								</select>
							</div>

							<div class="field">
								<label class="label">Formato *</label>
								<select class="select" formControlName="format">
									<option value="PDF">PDF</option>
									<option value="XLSX">XLSX</option>
									<option value="CSV">CSV</option>
								</select>
							</div>

							<div class="field sm:col-span-2">
								<label class="label">Cron expression *</label>
								<input
									type="text"
									class="input font-mono text-xs"
									formControlName="cronExpression"
									placeholder="0 0 8 1 * *"
								/>
								<div class="mt-1 flex flex-wrap gap-1">
									@for (preset of CRON_PRESETS; track preset.expression) {
										<button
											type="button"
											class="badge badge-muted cursor-pointer hover:bg-surface-muted"
											(click)="applyCronPreset(preset.expression)"
											data-testid="cron-preset"
										>
											{{ preset.label }}: <span class="ml-1 font-mono">{{ preset.expression }}</span>
										</button>
									}
								</div>
								@if (cronError(); as msg) {
									<p class="field-error">{{ msg }}</p>
								}
							</div>

							<div class="field">
								<label class="label">Timezone *</label>
								<input type="text" class="input font-mono" formControlName="timezone" placeholder="America/Lima" />
							</div>

							<div class="field flex items-center gap-3">
								<label class="flex items-center gap-2 text-sm">
									<input type="checkbox" class="form-checkbox" formControlName="active" />
									<span>Activa</span>
								</label>
							</div>

							<div class="field sm:col-span-2">
								<label class="label">Destinatarios (uno por línea) *</label>
								<textarea
									class="input font-mono text-xs"
									formControlName="recipientsRaw"
									rows="3"
									spellcheck="false"
									placeholder="director@colegio.pe&#10;admin@colegio.pe"
								></textarea>
								<p class="field-hint">
									Vacío = el reporte se genera pero no se envía por email.
								</p>
							</div>

							<div class="field">
								<label class="label">Asunto del email</label>
								<input type="text" class="input" formControlName="emailSubject" maxlength="200" />
							</div>

							<div class="field">
								<label class="label">Params (JSON)</label>
								<input type="text" class="input font-mono text-xs" formControlName="params" placeholder='{"courseUuid":"..."}' />
							</div>

							<div class="field sm:col-span-2">
								<label class="label">Descripción</label>
								<textarea class="input" formControlName="description" rows="2" maxlength="500"></textarea>
							</div>

							@if (templateError(); as msg) {
								<div class="sm:col-span-2 text-sm text-danger" data-testid="template-error">{{ msg }}</div>
							}

							<footer class="flex justify-end gap-2 sm:col-span-2">
								<button type="button" class="btn btn-ghost btn-sm" (click)="cancelTemplateEdit()">Cancelar</button>
								<button
									type="submit"
									class="btn btn-primary btn-sm"
									[disabled]="templateForm.invalid || savingTemplate()"
									data-testid="template-save"
								>
									@if (savingTemplate()) {
										<app-spinner [size]="12" label="Guardando" />
										<span>Guardando…</span>
									} @else {
										<app-icon name="check" [size]="14" />
										<span>{{ draft.existing ? 'Guardar cambios' : 'Crear plantilla' }}</span>
									}
								</button>
							</footer>
						</form>
					</div>
				}

				@if (deletingTemplate(); as target) {
					<div class="card mt-6 border-l-4 border-l-danger">
						<header class="card-header">
							<h3 class="card-title text-danger">Eliminar plantilla</h3>
						</header>
						<div class="card-body">
							<p class="text-sm text-content">
								¿Eliminar <strong>{{ target.name }}</strong>? Las próximas ejecuciones se detendrán.
							</p>
						</div>
						<footer class="card-header flex justify-end gap-2">
							<button type="button" class="btn btn-ghost btn-sm" (click)="cancelTemplateDelete()">Cancelar</button>
							<button type="button" class="btn btn-danger btn-sm" (click)="doTemplateDelete()" [disabled]="savingTemplate()">
								<app-icon name="trash-2" [size]="14" />
								<span>Eliminar</span>
							</button>
						</footer>
					</div>
				}
			}
		</app-page-container>
	`,
})
export class ReportCatalogPageComponent implements OnInit {
	private readonly fb = inject(FormBuilder);
	private readonly reportsApi = inject(ReportsApiService);
	private readonly templatesApi = inject(ReportTemplatesApiService);

	protected readonly ROUTES = ROUTES;
	protected readonly loading = signal(false);
	protected readonly jobs = signal<readonly ReportJob[]>([]);
	protected readonly templates = signal<readonly ReportTemplate[]>([]);
	protected readonly activeTab = signal<'jobs' | 'templates'>('jobs');

	// Template form state
	protected readonly savingTemplate = signal(false);
	protected readonly editingTemplate = signal<{ existing: ReportTemplate | null } | null>(null);
	protected readonly deletingTemplate = signal<ReportTemplate | null>(null);
	protected readonly templateError = signal<string | null>(null);
	protected readonly cronError = signal<string | null>(null);

	protected readonly REPORT_TYPE_OPTIONS = [
		{ value: 'GRADE_BOOK', label: 'Libreta de calificaciones' },
		{ value: 'ATTENDANCE_SUMMARY', label: 'Resumen de asistencia' },
		{ value: 'PERIOD_CLOSE', label: 'Cierre de periodo' },
		{ value: 'STUDENT_TRANSCRIPT', label: 'Historial del estudiante' },
	];

	protected readonly CRON_PRESETS = [
		{ label: 'Cada minuto', expression: '* * * * * *' },
		{ label: 'Cada hora', expression: '0 0 * * * *' },
		{ label: 'Cada día 08:00', expression: '0 0 8 * * *' },
		{ label: 'Primer día del mes 08:00', expression: '0 0 8 1 * *' },
		{ label: 'Lunes 08:00', expression: '0 0 8 * * 1' },
	];

	protected readonly templateForm: FormGroup = this.fb.group({
		name: ['', [Validators.required, Validators.maxLength(120)]],
		description: ['', Validators.maxLength(500)],
		reportType: ['GRADE_BOOK' as ReportTemplate['reportType'], Validators.required],
		format: ['PDF' as ReportTemplate['format'], Validators.required],
		active: [true],
		cronExpression: ['0 0 8 1 * *', [Validators.required, Validators.minLength(5)]],
		timezone: ['America/Lima', [Validators.required]],
		recipientsRaw: ['', [Validators.required, this.recipientsValidator()]],
		emailSubject: ['', Validators.maxLength(200)],
		params: ['{}'],
	});

	private static readonly CRON_FIELD_COUNT = 6;

	async ngOnInit(): Promise<void> {
		await this.reloadAll();
	}

	async reloadAll(): Promise<void> {
		this.loading.set(true);
		try {
			const [jobs, templates] = await Promise.all([
				firstValueFrom(this.reportsApi.list(0, 50)).catch(() => [] as ReportJob[]),
				firstValueFrom(this.templatesApi.list(0, 100)).catch(() => [] as ReportTemplate[]),
			]);
			this.jobs.set(jobs ?? []);
			this.templates.set(templates ?? []);
		}
		finally {
			this.loading.set(false);
		}
	}

	protected downloadHref(publicUuid: string): string {
		return this.reportsApi.downloadUrl(publicUuid);
	}

	protected reportTypeLabel(type: string | null | undefined): string {
		const opt = this.REPORT_TYPE_OPTIONS.find((o) => o.value === (type ?? '').toUpperCase());
		return opt?.label ?? (type ?? '—');
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

	protected applyCronPreset(cron: string): void {
		this.templateForm.patchValue({ cronExpression: cron });
	}

	protected openTemplateEdit(template: ReportTemplate | null): void {
		this.templateError.set(null);
		this.cronError.set(null);
		if (template) {
			this.templateForm.reset({
				name: template.name,
				description: template.description ?? '',
				reportType: template.reportType,
				format: template.format,
				active: template.active,
				cronExpression: template.cronExpression,
				timezone: template.timezone,
				recipientsRaw: (template.recipients ?? []).join('\n'),
				emailSubject: template.emailSubject ?? '',
				params: template.params ?? '{}',
			});
		}
		else {
			this.templateForm.reset({
				name: '',
				description: '',
				reportType: 'GRADE_BOOK',
				format: 'PDF',
				active: true,
				cronExpression: '0 0 8 1 * *',
				timezone: 'America/Lima',
				recipientsRaw: '',
				emailSubject: '',
				params: '{}',
			});
		}
		this.editingTemplate.set({ existing: template });
	}

	protected cancelTemplateEdit(): void {
		this.editingTemplate.set(null);
		this.templateError.set(null);
		this.cronError.set(null);
	}

	protected confirmTemplateDelete(template: ReportTemplate): void {
		this.editingTemplate.set(null);
		this.templateError.set(null);
		this.deletingTemplate.set(template);
	}

	protected cancelTemplateDelete(): void {
		this.deletingTemplate.set(null);
	}

	protected async submitTemplate(): Promise<void> {
		if (this.templateForm.invalid) return;
		const draft = this.editingTemplate();
		if (!draft) return;
		const payload = this.toTemplateRequest();
		const cronCheck = this.validateCron(payload.cronExpression);
		if (cronCheck !== null) {
			this.cronError.set(cronCheck);
			return;
		}
		this.cronError.set(null);
		this.savingTemplate.set(true);
		this.templateError.set(null);
		try {
			if (draft.existing) {
				await firstValueFrom(this.templatesApi.update(draft.existing.publicUuid, payload));
			}
			else {
				await firstValueFrom(this.templatesApi.create(payload));
			}
			this.editingTemplate.set(null);
			await this.reloadAll();
		}
		catch (err: unknown) {
			this.templateError.set(this.extractError(err, 'No se pudo guardar la plantilla.'));
		}
		finally {
			this.savingTemplate.set(false);
		}
	}

	protected async doTemplateDelete(): Promise<void> {
		const target = this.deletingTemplate();
		if (!target) return;
		this.savingTemplate.set(true);
		this.templateError.set(null);
		try {
			await firstValueFrom(this.templatesApi.softDelete(target.publicUuid));
			this.deletingTemplate.set(null);
			await this.reloadAll();
		}
		catch (err: unknown) {
			this.templateError.set(this.extractError(err, 'No se pudo eliminar la plantilla.'));
		}
		finally {
			this.savingTemplate.set(false);
		}
	}

	private toTemplateRequest(): ReportTemplateRequest {
		const v = this.templateForm.getRawValue();
		const recipients = String(v.recipientsRaw ?? '')
			.split(/[\n,;]+/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		return {
			name: String(v.name ?? '').trim(),
			description: (v.description ?? '').toString().trim() || null,
			reportType: v.reportType as ReportTemplate['reportType'],
			format: v.format as ReportTemplate['format'],
			active: Boolean(v.active),
			cronExpression: String(v.cronExpression ?? '').trim(),
			timezone: String(v.timezone ?? '').trim(),
			recipients,
			emailSubject: (v.emailSubject ?? '').toString().trim() || null,
			emailBodyTemplate: null,
			params: (v.params ?? '{}').toString(),
		};
	}

	private recipientsValidator() {
		return (ctrl: FormControl<string | null>): null | { invalid: boolean } => {
			const raw = (ctrl.value ?? '').toString().trim();
			if (raw.length === 0) return null; // empty is allowed by BE; FE just disables
			const parts = raw.split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.length > 0);
			const valid = parts.every((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
			return valid || parts.length === 0 ? null : { invalid: true };
		};
	}

	private validateCron(cron: string): string | null {
		const fields = cron.trim().split(/\s+/);
		if (fields.length !== ReportCatalogPageComponent.CRON_FIELD_COUNT) {
			return `El cron debe tener 6 campos (sec min hour dom mon dow). Encontrados: ${fields.length}.`;
		}
		return null;
	}

	private extractError(err: unknown, fallback: string): string {
		if (err instanceof HttpErrorResponse) {
			const apiErr = (err.error as { error?: { message?: string }; message?: string } | null | undefined);
			return apiErr?.error?.message ?? apiErr?.message ?? fallback;
		}
		return fallback;
	}
}