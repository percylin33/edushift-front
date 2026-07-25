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
import {
	FormBuilder,
	FormGroup,
	ReactiveFormsModule,
	Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
	IconComponent,
	PageContainerComponent,
	PageHeaderComponent,
	SpinnerComponent,
} from '@shared/components';
import {
	NotificationTemplate,
	NotificationTemplatesApiService,
} from '../../services/notification-templates-api.service';

/**
 * Sprint cierre-C / F11 — Notification templates editor (TENANT_ADMIN).
 *
 * <p>List of every {@code (template_key, locale)} pair the tenant has
 * (built-in {@code is_system=true} seeds plus any tenant overrides)
 * with an inline editor drawer. Save flips the BE's
 * {@code version} counter so {@code NotificationTemplateEngine}'s
 * cache invalidates; the rendered HTML body is sanitized with jsoup
 * on the server before persistence.</p>
 *
 * <p>The editor is intentionally narrow: subject + body. Adding a new
 * template is a developer-only operation today (the BE only exposes
 * list + patch); the closure plan keeps {@code create} out of V1.</p>
 */
@Component({
	selector: 'app-notification-templates-page',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		DatePipe,
		ReactiveFormsModule,
		PageContainerComponent,
		PageHeaderComponent,
		IconComponent,
		SpinnerComponent,
	],
	template: `
		<app-page-container size="wide">
			<app-page-header
				eyebrow="Notificaciones"
				title="Plantillas"
				subtitle="Editá el subject y el body de cada plantilla. Soporta placeholders como {{'{{'}}key{{'}}'}}."
			>
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

			@if (loading() && templates().length === 0) {
				<div class="flex items-center justify-center py-16">
					<app-spinner [size]="24" label="Cargando plantillas…" />
				</div>
			} @else if (templates().length === 0) {
				<div role="alert" class="card border-l-4 border-l-info bg-info/5">
					<div class="card-body flex items-start gap-3">
						<app-icon name="info" [size]="20" class="mt-0.5 shrink-0 text-info" />
						<p class="text-sm text-content-muted">
							Aún no hay plantillas en este tenant. Esto puede ocurrir si los seeds del
							starter-pack no se ejecutaron; revisá la tabla
							<code>edushift.notification_templates</code> o contactá a soporte.
						</p>
					</div>
				</div>
			} @else {
				<div class="card overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-content-subtle">
								<tr>
									<th class="px-4 py-3 font-medium">Key</th>
									<th class="px-4 py-3 font-medium">Locale</th>
									<th class="px-4 py-3 font-medium">Subject</th>
									<th class="px-4 py-3 font-medium">v</th>
									<th class="px-4 py-3 font-medium">Origen</th>
									<th class="px-4 py-3 text-right font-medium">Acciones</th>
								</tr>
							</thead>
							<tbody>
								@for (t of templates(); track t.publicUuid) {
									<tr
										class="border-b border-border last:border-b-0 hover:bg-surface-muted/40"
										[attr.data-testid]="'template-row-' + t.templateKey"
									>
										<td class="px-4 py-3 font-mono text-xs text-content">{{ t.templateKey }}</td>
										<td class="px-4 py-3 text-content-muted">{{ t.locale }}</td>
										<td class="px-4 py-3 text-content">
											<span class="line-clamp-1">{{ t.subject }}</span>
										</td>
										<td class="px-4 py-3 text-content-muted">v{{ t.version }}</td>
										<td class="px-4 py-3">
											@if (t.system) {
												<span class="badge badge-muted">Seed</span>
											} @else {
												<span class="badge badge-info">Custom</span>
											}
										</td>
										<td class="px-4 py-3 text-right">
											<button
												type="button"
												class="btn btn-ghost btn-xs"
												(click)="openEdit(t)"
												[attr.data-testid]="'template-edit-' + t.templateKey"
											>
												<app-icon name="pencil" [size]="12" />
												<span>Editar</span>
											</button>
										</td>
									</tr>
								}
							</tbody>
						</table>
					</div>
				</div>
			}

			<!-- Inline edit drawer -->
			@if (editing(); as draft) {
				<div class="card mt-6" data-testid="template-editor">
					<header class="card-header flex items-center justify-between gap-3">
						<div>
							<h2 class="card-title">Editar plantilla</h2>
							<p class="text-xs text-content-muted">
								<span class="font-mono">{{ draft.existing.templateKey }}</span> · {{ draft.existing.locale }}
							</p>
						</div>
						<button type="button" class="btn btn-ghost btn-sm" (click)="cancelEdit()">
							<app-icon name="x" [size]="14" />
						</button>
					</header>

					<form
						[formGroup]="form"
						(ngSubmit)="submit()"
						class="card-body grid gap-4 lg:grid-cols-2"
					>
						<div class="field lg:col-span-2">
							<label class="label">Asunto *</label>
							<input
								type="text"
								class="input"
								formControlName="subject"
								maxlength="200"
							/>
						</div>
						<div class="field">
							<label class="label">Body HTML *</label>
							<textarea
								class="input font-mono text-xs"
								formControlName="bodyHtml"
								rows="14"
								spellcheck="false"
							></textarea>
							<p class="field-hint">
								Placeholders: {{ '{{' }}student.firstName{{ '}}' }}, {{ '{{' }}session.title{{ '}}' }}, etc.
								Se sanitiza con jsoup en el servidor.
							</p>
						</div>
						<div class="field">
							<label class="label">Preview</label>
							<div
								class="min-h-32 rounded-md border border-border-subtle bg-surface-subtle p-3 text-sm"
								data-testid="template-preview"
								[innerHTML]="previewHtml()"
							></div>
							<p class="field-hint">
								v{{ draft.existing.version }} · El servidor sanitiza tags inseguros.
							</p>
						</div>

						@if (formError(); as msg) {
							<div class="lg:col-span-2 text-sm text-danger" data-testid="template-error">
								{{ msg }}
							</div>
						}

						<footer class="flex justify-end gap-2 lg:col-span-2">
							<button type="button" class="btn btn-ghost btn-sm" (click)="cancelEdit()">
								Cancelar
							</button>
							<button
								type="submit"
								class="btn btn-primary btn-sm"
								[disabled]="form.invalid || saving()"
								data-testid="template-save"
							>
								@if (saving()) {
									<app-spinner [size]="12" label="Guardando" />
									<span>Guardando…</span>
								} @else {
									<app-icon name="check" [size]="14" />
									<span>Guardar y bumpear versión</span>
								}
							</button>
						</footer>
					</form>
				</div>
			}
		</app-page-container>
	`,
})
export class NotificationTemplatesPageComponent implements OnInit {
	private readonly fb = inject(FormBuilder);
	private readonly api = inject(NotificationTemplatesApiService);

	protected readonly loading = signal(false);
	protected readonly saving = signal(false);
	protected readonly templates = signal<readonly NotificationTemplate[]>([]);
	protected readonly editing = signal<{ existing: NotificationTemplate } | null>(null);
	protected readonly formError = signal<string | null>(null);

	protected readonly form: FormGroup = this.fb.group({
		subject: ['', [Validators.required, Validators.maxLength(200)]],
		bodyHtml: ['', [Validators.required, Validators.minLength(8)]],
	});

	/** What the renderer would see if all {{keys}} were empty. The BE
	 * substitutes the real values at notification time. */
	protected readonly previewHtml = computed(() => this.form.get('bodyHtml')?.value ?? '');

	async ngOnInit(): Promise<void> {
		await this.reload();
	}

	async reload(): Promise<void> {
		this.loading.set(true);
		try {
			const data = await firstValueFrom(this.api.list());
			// Sort by template_key for stable presentation.
			this.templates.set([...data].sort((a, b) => a.templateKey.localeCompare(b.templateKey)));
		}
		catch (err: unknown) {
			console.error('[notification-templates] reload failed', err);
			this.templates.set([]);
		}
		finally {
			this.loading.set(false);
		}
	}

	openEdit(template: NotificationTemplate): void {
		this.formError.set(null);
		this.form.reset({
			subject: template.subject,
			bodyHtml: template.bodyHtml,
		});
		this.editing.set({ existing: template });
	}

	cancelEdit(): void {
		this.editing.set(null);
		this.formError.set(null);
	}

	async submit(): Promise<void> {
		if (this.form.invalid) return;
		const draft = this.editing();
		if (!draft) return;
		this.saving.set(true);
		this.formError.set(null);
		try {
			const payload = {
				subject: String(this.form.get('subject')?.value ?? '').trim(),
				bodyHtml: String(this.form.get('bodyHtml')?.value ?? ''),
			};
			await firstValueFrom(this.api.update(draft.existing.publicUuid, payload));
			this.editing.set(null);
			await this.reload();
		}
		catch (err: unknown) {
			this.formError.set(this.extractError(err, 'No se pudo guardar la plantilla.'));
		}
		finally {
			this.saving.set(false);
		}
	}

	private extractError(err: unknown, fallback: string): string {
		if (err instanceof HttpErrorResponse) {
			const apiErr = (err.error as { error?: { message?: string }; message?: string } | null | undefined);
			return apiErr?.error?.message ?? apiErr?.message ?? fallback;
		}
		return fallback;
	}
}