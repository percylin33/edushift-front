import { CommonModule, DatePipe } from '@angular/common';
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
	EmptyStateComponent,
	IconComponent,
	PageContainerComponent,
	PageHeaderComponent,
	SpinnerComponent,
} from '@shared/components';
import { CommonLabels } from '@core/i18n/common-labels.service';
import { HttpErrorResponse } from '@angular/common/http';
import {
	PaymentConcept,
	PaymentConceptCategory,
	PaymentConceptRequest,
	PaymentConceptsApiService,
} from '../../services/payment-concepts-api.service';

/**
 * Sprint cierre-C / F14 — Admin Payment Concepts page.
 *
 * <p>List + inline create / edit / soft-delete of tenant-scoped billing
 * concepts (matrícula, cuota mensual, materiales, refrigerio, examen
 * extra, evento, etc.). Backed by the B5 part 1 BE endpoints at
 * {@code /admin/payments/concepts}.</p>
 *
 * <p>UI choices:
 * <ul>
 *   <li><b>Single-screen list</b> — the page shows the table + a collapsible
 *       drawer with the create/edit form. Saves a route hop and keeps
 *       the admin's context when iterating.</li>
 *   <li><b>Money in centavos</b> — the BE stores amounts as bigint
 *       cents; the form takes cents as the canonical unit and the UI
 *       displays {@code S/ 1,250.00} via a small formatter.</li>
 *   <li><b>Soft-delete</b> — DELETE flips {@code deleted=true}. The row
 *       disappears from the list immediately (the BE list query
 *       filters {@code deleted=false}); admins can recreate the code
 *       later without history pollution.</li>
 * </ul>
 * </p>
 */
@Component({
	selector: 'app-payment-concepts-page',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		CommonModule,
		DatePipe,
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
				eyebrow="Pagos · Administración"
				title="Conceptos de pago"
				subtitle="Catálogo de conceptos cobrables que se usan al emitir facturas."
			>
				<button
					type="button"
					class="btn btn-primary btn-sm"
					(click)="openCreate()"
					data-testid="concepts-new"
				>
					<app-icon name="plus" [size]="14" />
					<span>Nuevo concepto</span>
				</button>
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

			@if (loading() && concepts().length === 0) {
				<div class="flex items-center justify-center py-16">
					<app-spinner [size]="24" [label]="commonLabels.cargando()" />
				</div>
			} @else if (concepts().length === 0) {
				<app-empty-state
					icon="layers"
					title="Aún no hay conceptos configurados"
					description="Creá el primer concepto (por ejemplo: Matrícula 2026) para empezar a emitir facturas."
				/>
			} @else {
				<div class="card overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-content-subtle">
								<tr>
									<th class="px-4 py-3 font-medium">Código</th>
									<th class="px-4 py-3 font-medium">Nombre</th>
									<th class="px-4 py-3 font-medium">Categoría</th>
									<th class="px-4 py-3 text-right font-medium">Monto por defecto</th>
									<th class="px-4 py-3 font-medium">Recurrente</th>
									<th class="px-4 py-3 font-medium">Activo</th>
									<th class="px-4 py-3 font-medium">Actualizado</th>
									<th class="px-4 py-3 text-right font-medium">Acciones</th>
								</tr>
							</thead>
							<tbody>
								@for (c of concepts(); track c.publicUuid) {
									<tr class="border-b border-border last:border-b-0 hover:bg-surface-muted/40">
										<td class="px-4 py-3 font-mono text-content">{{ c.code }}</td>
										<td class="px-4 py-3 font-medium text-content">{{ c.name }}</td>
										<td class="px-4 py-3 text-content-muted">{{ categoryLabel(c.category) }}</td>
										<td class="px-4 py-3 text-right tabular-nums">
											{{ formatMoney(c.defaultAmountCents, c.currency) }}
										</td>
										<td class="px-4 py-3">
											@if (c.recurring) {
												<span class="badge badge-info">Sí</span>
											} @else {
												<span class="text-content-subtle">—</span>
											}
										</td>
										<td class="px-4 py-3">
											@if (c.active) {
												<span class="badge badge-success">Activo</span>
											} @else {
												<span class="badge badge-muted">Inactivo</span>
											}
										</td>
										<td class="px-4 py-3 text-xs text-content-muted">
											{{ c.updatedAt | date: 'short' }}
										</td>
										<td class="px-4 py-3 text-right">
											<button
												type="button"
												class="btn btn-ghost btn-xs"
												(click)="openEdit(c)"
												[attr.data-testid]="'concept-edit-' + c.publicUuid"
											>
												<app-icon name="pencil" [size]="12" />
												<span>Editar</span>
											</button>
											<button
												type="button"
												class="btn btn-ghost btn-xs text-danger"
												(click)="confirmDelete(c)"
												[attr.data-testid]="'concept-delete-' + c.publicUuid"
											>
												<app-icon name="trash-2" [size]="12" />
					<span>{{ commonLabels.eliminar() }}</span>
											</button>
										</td>
									</tr>
								}
							</tbody>
						</table>
					</div>
				</div>
			}

			<!-- Inline drawer for create / edit -->
			@if (editing(); as draft) {
				<div class="card mt-6" data-testid="concepts-form">
					<header class="card-header flex items-center justify-between">
						<h2 class="card-title">
							{{ draft.editingExisting ? 'Editar concepto' : 'Nuevo concepto' }}
						</h2>
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							(click)="cancelEdit()"
						>
							<app-icon name="x" [size]="14" />
						</button>
					</header>
					<form
						[formGroup]="form"
						(ngSubmit)="submit()"
						class="card-body grid gap-4 sm:grid-cols-2"
					>
						<div class="field">
							<label class="label">Código *</label>
							<input
								type="text"
								class="input font-mono uppercase"
								formControlName="code"
								placeholder="MATRICULA"
								maxlength="40"
								[disabled]="draft.editingExisting"
							/>
							<p class="field-hint">
								Único por tenant; mayúsculas, dígitos y guion bajo.
							</p>
							@if (form.get('code')?.invalid && form.get('code')?.touched) {
								<p class="field-error">Sólo letras mayúsculas, dígitos y _ (empieza con letra).</p>
							}
						</div>
						<div class="field">
							<label class="label">Nombre *</label>
							<input
								type="text"
								class="input"
								formControlName="name"
								placeholder="Matrícula 2026"
								maxlength="120"
							/>
						</div>
						<div class="field">
							<label class="label">Categoría *</label>
							<select class="input" formControlName="category">
								@for (cat of CATEGORIES; track cat) {
									<option [value]="cat">{{ categoryLabel(cat) }}</option>
								}
							</select>
						</div>
						<div class="field">
							<label class="label">Monto por defecto (centavos) *</label>
							<input
								type="number"
								class="input"
								formControlName="defaultAmountCents"
								min="0"
								step="1"
							/>
							<p class="field-hint">
								{{ formatMoney(form.get('defaultAmountCents')?.value ?? 0, form.get('currency')?.value) }}
							</p>
						</div>
						<div class="field">
							<label class="label">Moneda *</label>
							<input
								type="text"
								class="input font-mono uppercase"
								formControlName="currency"
								maxlength="3"
								placeholder="PEN"
							/>
						</div>
						<div class="field flex items-center gap-3">
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" class="form-checkbox" formControlName="recurring" />
								<span>Recurrente</span>
							</label>
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" class="form-checkbox" formControlName="active" />
								<span>Activo</span>
							</label>
							<div class="flex-1">
								<label class="label">Orden</label>
								<input
									type="number"
									class="input"
									formControlName="sortOrder"
									step="1"
								/>
							</div>
						</div>
						<div class="field sm:col-span-2">
							<label class="label">Descripción</label>
							<textarea
								class="input"
								formControlName="description"
								rows="2"
								maxlength="500"
								placeholder="Cuándo aplica este concepto y qué incluye."
							></textarea>
						</div>

						@if (formError(); as msg) {
							<div class="sm:col-span-2 text-sm text-danger" data-testid="concepts-form-error">
								{{ msg }}
							</div>
						}

						<footer class="flex justify-end gap-2 sm:col-span-2">
							<button type="button" class="btn btn-ghost btn-sm" (click)="cancelEdit()">
								Cancelar
							</button>
							<button
								type="submit"
								class="btn btn-primary btn-sm"
								[disabled]="form.invalid || saving()"
								data-testid="concepts-save"
							>
								@if (saving()) {
									<app-spinner [size]="12" label="Guardando" />
									<span>Guardando…</span>
								} @else {
									<app-icon name="check" [size]="14" />
									<span>{{ draft.editingExisting ? 'Guardar cambios' : 'Crear concepto' }}</span>
								}
							</button>
						</footer>
					</form>
				</div>
			}

			<!-- Inline delete confirmation -->
			@if (deleting(); as target) {
				<div class="card mt-6 border-l-4 border-l-danger">
					<header class="card-header">
						<h3 class="card-title text-danger">Eliminar concepto</h3>
					</header>
					<div class="card-body">
						<p class="text-sm text-content">
							¿Eliminar <strong>{{ target.name }}</strong> ({{ target.code }})?
							Esta acción es reversible solo creando un nuevo concepto con el mismo código.
						</p>
						@if (deleteError(); as msg) {
							<p class="mt-2 text-sm text-danger">{{ msg }}</p>
						}
					</div>
					<footer class="card-header flex justify-end gap-2">
						<button type="button" class="btn btn-ghost btn-sm" (click)="cancelDelete()">
							Cancelar
						</button>
						<button
							type="button"
							class="btn btn-danger btn-sm"
							(click)="doDelete()"
							[disabled]="saving()"
							data-testid="concepts-delete-confirm"
						>
							<app-icon name="trash-2" [size]="14" />
							<span>{{ commonLabels.eliminar() }}</span>
						</button>
					</footer>
				</div>
			}
		</app-page-container>
	`,
})
export class PaymentConceptsPageComponent implements OnInit {
	private readonly fb = inject(FormBuilder);
	private readonly conceptsApi = inject(PaymentConceptsApiService);
	protected readonly commonLabels = inject(CommonLabels);

	protected readonly CATEGORIES: readonly PaymentConceptCategory[] = [
		'TUITION', 'ENROLLMENT', 'MATERIALS', 'MEALS', 'TRANSPORT', 'EXAM', 'EVENT', 'OTHER',
	];

	protected readonly loading = signal(false);
	protected readonly saving = signal(false);
	protected readonly concepts = signal<readonly PaymentConcept[]>([]);
	protected readonly editing = signal<{ existing: PaymentConcept | null; editingExisting: boolean } | null>(null);
	protected readonly deleting = signal<PaymentConcept | null>(null);
	protected readonly formError = signal<string | null>(null);
	protected readonly deleteError = signal<string | null>(null);

	protected readonly form: FormGroup = this.fb.group({
		code: ['', [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9_]*$/), Validators.maxLength(40)]],
		name: ['', [Validators.required, Validators.maxLength(120)]],
		description: ['', Validators.maxLength(500)],
		category: ['TUITION' as PaymentConceptCategory, Validators.required],
		defaultAmountCents: [0, [Validators.required, Validators.min(0)]],
		currency: ['PEN', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
		recurring: [false],
		active: [true],
		sortOrder: [0],
	});

	async ngOnInit(): Promise<void> {
		await this.reload();
	}

	async reload(): Promise<void> {
		this.loading.set(true);
		try {
			const { items } = await firstValueFrom(this.conceptsApi.listConcepts(0, 100));
			this.concepts.set(items);
		}
		catch (err: unknown) {
			// Surface a soft error in the empty state.
			console.error('[payment-concepts] reload failed', err);
			this.concepts.set([]);
		}
		finally {
			this.loading.set(false);
		}
	}

	openCreate(): void {
		this.deleting.set(null);
		this.formError.set(null);
		this.form.reset({
			code: '',
			name: '',
			description: '',
			category: 'TUITION',
			defaultAmountCents: 0,
			currency: 'PEN',
			recurring: false,
			active: true,
			sortOrder: 0,
		});
		this.editing.set({ existing: null, editingExisting: false });
	}

	openEdit(concept: PaymentConcept): void {
		this.deleting.set(null);
		this.formError.set(null);
		this.form.reset({
			code: concept.code,
			name: concept.name,
			description: concept.description ?? '',
			category: concept.category,
			defaultAmountCents: concept.defaultAmountCents,
			currency: concept.currency,
			recurring: concept.recurring,
			active: concept.active,
			sortOrder: concept.sortOrder,
		});
		this.editing.set({ existing: concept, editingExisting: true });
	}

	cancelEdit(): void {
		this.editing.set(null);
		this.formError.set(null);
	}

	confirmDelete(concept: PaymentConcept): void {
		this.editing.set(null);
		this.deleteError.set(null);
		this.deleting.set(concept);
	}

	cancelDelete(): void {
		this.deleting.set(null);
		this.deleteError.set(null);
	}

	async submit(): Promise<void> {
		if (this.form.invalid) return;
		const draft = this.editing();
		if (!draft) return;
		this.saving.set(true);
		this.formError.set(null);
		try {
			const payload = this.toRequest();
			if (draft.editingExisting && draft.existing) {
				await firstValueFrom(
					this.conceptsApi.update(draft.existing.publicUuid, payload),
				);
			}
			else {
				await firstValueFrom(this.conceptsApi.create(payload));
			}
			this.editing.set(null);
			await this.reload();
		}
		catch (err: unknown) {
			this.formError.set(this.extractError(err, 'No se pudo guardar el concepto.'));
		}
		finally {
			this.saving.set(false);
		}
	}

	async doDelete(): Promise<void> {
		const target = this.deleting();
		if (!target) return;
		this.saving.set(true);
		this.deleteError.set(null);
		try {
			await firstValueFrom(this.conceptsApi.softDelete(target.publicUuid));
			this.deleting.set(null);
			await this.reload();
		}
		catch (err: unknown) {
			this.deleteError.set(this.extractError(err, 'No se pudo eliminar el concepto.'));
		}
		finally {
			this.saving.set(false);
		}
	}

	private toRequest(): PaymentConceptRequest {
		const v = this.form.getRawValue();
		return {
			code: String(v.code).trim().toUpperCase(),
			name: String(v.name).trim(),
			description: (v.description ?? '').toString().trim() || null,
			category: v.category as PaymentConceptCategory,
			defaultAmountCents: Number(v.defaultAmountCents) || 0,
			currency: String(v.currency).trim().toUpperCase(),
			recurring: Boolean(v.recurring),
			active: Boolean(v.active),
			sortOrder: Number(v.sortOrder) || 0,
		};
	}

	private extractError(err: unknown, fallback: string): string {
		if (err instanceof HttpErrorResponse) {
			const apiErr = (err.error as { error?: { message?: string }; message?: string } | null | undefined);
			return apiErr?.error?.message ?? apiErr?.message ?? fallback;
		}
		return fallback;
	}

	categoryLabel(cat: PaymentConceptCategory | string): string {
		switch (cat) {
			case 'TUITION': return 'Cuota';
			case 'ENROLLMENT': return 'Matrícula';
			case 'MATERIALS': return 'Materiales';
			case 'MEALS': return 'Refrigerio';
			case 'TRANSPORT': return 'Transporte';
			case 'EXAM': return 'Examen';
			case 'EVENT': return 'Evento';
			case 'OTHER': return 'Otro';
			default: return String(cat);
		}
	}

	formatMoney(cents: number | string, currency: string | null | undefined): string {
		const c = Number(cents) || 0;
		const cur = (currency ?? 'PEN').toUpperCase();
		const major = c / 100;
		try {
			return new Intl.NumberFormat('es-PE', {
				style: 'currency',
				currency: cur,
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}).format(major);
		}
		catch {
			return `${cur} ${major.toFixed(2)}`;
		}
	}
}