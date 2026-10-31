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
import { centsToSoles, solesToCents } from '../../models/invoice.model';

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
 *   <li><b>Money in soles</b> — the BE stores amounts as bigint
 *       cents; the form takes soles and converts with {@code solesToCents}
 *       on save. Lists still show {@code S/ 1,250.00} via formatter.</li>
 *   <li><b>Soft-delete</b> — DELETE flips {@code deleted=true}. The row
 *       disappears from the list immediately (the BE list query
 *       filters {@code deleted=false}); admins can recreate the code
 *       later without history pollution.</li>
 * </ul>
 * </p>
 */
/** Opciones predefinidas para crear conceptos automáticamente. */
interface AutoCreateOption {
	key: string;
	name: string;
	description: string;
	suggestedCode: string;
	suggestedAmount: string;
	defaultChecked: boolean;
	category: PaymentConceptCategory;
	recurringDefault?: boolean;
}

interface PaymentConceptExample {
	code: string;
	name: string;
	amount: string;
}

interface PaymentConceptExampleGroup {
	title: string;
	items: readonly PaymentConceptExample[];
	tip?: string;
}

const EXAMPLE_GROUPS: readonly PaymentConceptExampleGroup[] = [
	{
		title: 'Pagos principales',
		items: [
			{ code: 'MATRICULA', name: 'Matrícula', amount: 'S/ 350.00' },
			{ code: 'PENSION', name: 'Pensión mensual', amount: 'S/ 450.00' },
			{ code: 'MATERIALES', name: 'Materiales escolares', amount: 'S/ 80.00' },
		],
		tip: 'Adapta los montos a las tarifas de cada colegio.',
	},
	{
		title: 'Servicios adicionales',
		items: [
			{ code: 'REFRIGERIO', name: 'Refrigerio', amount: 'S/ 10.00' },
			{ code: 'MOVILIDAD', name: 'Movilidad escolar', amount: 'S/ 180.00' },
		],
	},
];

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
					class="btn btn-ghost btn-sm"
					(click)="examplesOpen.set(!examplesOpen())"
					[attr.aria-expanded]="examplesOpen()"
					aria-controls="concept-examples-panel"
					title="Ver ejemplos de conceptos"
					data-testid="concepts-examples-toggle"
				>
					<app-icon name="info" [size]="16" />
					<span>Ejemplos</span>
				</button>
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

			@if (banner(); as notice) {
				<div class="mb-4 rounded-md px-4 py-3 text-sm" [class.bg-emerald-50]="notice.ok" [class.text-emerald-800]="notice.ok" [class.bg-rose-50]="!notice.ok" [class.text-rose-800]="!notice.ok" role="status">
					{{ notice.message }}
				</div>
			}

			@if (examplesOpen()) {
				<aside
					id="concept-examples-panel"
					class="card mb-6 border-l-4 border-l-sky-500"
					data-testid="concepts-examples-panel"
				>
					<header class="card-header flex items-start justify-between gap-3">
						<div>
							<h2 class="card-title text-base">Ejemplos para un colegio</h2>
							<p class="mt-1 text-sm text-content-muted">
								Ideas de códigos y montos. Adáptalos a tu tarifa; el monto se registra en soles.
							</p>
						</div>
						<button
							type="button"
							class="btn btn-ghost btn-sm shrink-0"
							(click)="examplesOpen.set(false)"
							aria-label="Cerrar ejemplos"
						>
							<app-icon name="x" [size]="16" />
						</button>
					</header>
					<div class="card-body space-y-5 text-sm">
						@for (group of EXAMPLE_GROUPS; track group.title) {
							<section>
								<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-content-subtle">
									{{ group.title }}
								</h3>
								<ul class="overflow-hidden rounded-lg ring-1 ring-border">
									<li
										class="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto] gap-2 border-b border-border bg-surface-muted px-3 py-1.5 text-2xs font-medium uppercase tracking-wide text-content-subtle"
									>
										<span>Código</span>
										<span>Nombre</span>
										<span class="text-right">Monto ej.</span>
									</li>
									@for (row of group.items; track row.code) {
										<li
											class="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_auto] gap-2 border-b border-border px-3 py-2 last:border-b-0"
										>
											<code class="truncate font-mono text-xs text-content">{{ row.code }}</code>
											<span class="truncate text-content">{{ row.name }}</span>
											<span class="text-right tabular-nums text-content-muted">{{ row.amount }}</span>
										</li>
									}
								</ul>
								@if (group.tip) {
									<p class="mt-1.5 text-xs text-content-muted">{{ group.tip }}</p>
								}
							</section>
						}
						<p class="rounded-md bg-surface-muted px-3 py-2 text-xs text-content-muted">
							<strong class="text-content">Tip:</strong> códigos en mayúsculas sin espacios
							(<code class="font-mono">PENSION_PRIMARIA</code>). Luego, en Emitir eliges el
							concepto y el monto se rellena solo.
						</p>
					</div>
				</aside>
			}

			@if (loading() && concepts().length === 0) {
				<div class="flex items-center justify-center py-16">
					<app-spinner [size]="24" [label]="commonLabels.cargando()" />
				</div>
			} @else if (concepts().length === 0) {
				<div class="card mb-6 p-6 max-w-2xl mx-auto">
					<h2 class="mb-4 text-xl font-bold text-slate-900 dark:text-slate-100">Primeros conceptos de pago</h2>
					<p class="text-slate-500 dark:text-slate-400 mb-6">
						Configuremos los conceptos más usados en colegios particulares para que puedas empezar a emitir facturas de inmediato.
					</p>

					<!-- Auto-create concepts form -->
					<form
						class="grid gap-4 sm:grid-cols-2"
						(submit)="autoCreateConcepts($event)"
					>
						@for (option of AUTO_CREATE_OPTIONS; track option.key) {
							<div class="field">
								<label class="flex items-center gap-2 cursor-pointer select-none">
									<input
										type="checkbox"
										class="checkbox"
										[checked]="selectedOptions().has(option.key)"
										(change)="toggleOption(option.key)"
									/>
									<span>
										<span class="font-medium text-slate-700 dark:text-slate-300">
											{{ option.name }}
										</span>
										<span class="text-xs text-slate-500 dark:text-slate-300">
											({{ option.description }})
										</span>
									</span>
								</label>
								@if (!option.defaultChecked) {
									<div class="mt-2 text-xs text-slate-400">
										Código: <strong class="font-mono uppercase">{{ option.suggestedCode }}</strong>
										<br />
										Monto sugerido: <strong>S/ {{ option.suggestedAmount }}</strong>
									</div>
								}
							</div>
						}

						<div class="sm:col-span-2">
							<div class="flex items-center justify-between">
								<label class="text-xs text-slate-500 dark:text-slate-300">
									<input type="checkbox" class="checkbox" [checked]="allSelected()" [indeterminate]="selectedCount() > 0 && !allSelected()" (change)="toggleAllOptions($event)" />
									Seleccionar todos
								</label>
								@if (selectedCount() > 0) {
									<span class="text-xs text-rose-600">({{ selectedCount() }} seleccionados)</span>
								}
							</div>
						</div>

						@if (formError(); as msg) {
							<div class="sm:col-span-2 text-sm text-danger" role="alert">{{ msg }}</div>
						}
						<div class="sm:col-span-2">
							<button
								type="submit"
								class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
								[disabled]="saving() || selectedCount() === 0"
							>
								@if (saving()) {
									<app-spinner [size]="12" label="Creando" />
									<span>Creando conceptos…</span>
								} @else {
									<app-icon name="check" [size]="14" />
									<span>Crear {{ selectedCount() }} concepto(s)</span>
								}
							</button>
						</div>
					</form>
				</div>
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
							<select class="select" formControlName="category">
								@for (cat of CATEGORIES; track cat) {
									<option [value]="cat">{{ categoryLabel(cat) }}</option>
								}
							</select>
						</div>
						<div class="field">
							<label class="label">Monto por defecto (S/) *</label>
							<input
								type="number"
								class="input"
								formControlName="defaultAmountSoles"
								min="0"
								step="0.01"
								placeholder="20.00"
							/>
							<p class="field-hint">
								Se guarda como
								{{ formatMoney(solesPreviewCents(), form.get('currency')?.value) }}
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

	protected readonly examplesOpen = signal(false);

	protected readonly EXAMPLE_GROUPS = EXAMPLE_GROUPS;

	protected readonly AUTO_CREATE_OPTIONS: readonly AutoCreateOption[] = [
		{
			key: 'enrollment',
			name: 'Matrícula / inscripción',
			description: 'Cobro único al momento del ingreso del estudiante',
			suggestedCode: 'MATRICULA',
			suggestedAmount: '350',
			defaultChecked: true,
			category: 'ENROLLMENT',
		},
		{
			key: 'tuition',
			name: 'Pensión Inicial',
			description: 'Cuota periódica mensual inicial para estudiantes nuevos (marca "Recurrente" si luego usas Planes de cobro)',
			suggestedCode: 'PENSION_INICIAL',
			suggestedAmount: '450',
			defaultChecked: true,
			category: 'TUITION',
			recurringDefault: true,
		},
		{
			key: 'tuition_2',
			name: 'Pensión Primaria',
			description: 'Cuota periódica mensual para estudiantes de primaria (marca "Recurrente" si luego usas Planes de cobro)',
			suggestedCode: 'PENSION_PRIMARIA',
			suggestedAmount: '520',
			defaultChecked: true,
			category: 'TUITION',
			recurringDefault: true,
		},
		{
			key: 'tuition_3',
			name: 'Pensión Secundaria',
			description: 'Cuota periódica mensual para estudiantes de secundaria (marca "Recurrente" si luego usas Planes de cobro)',
			suggestedCode: 'PENSION_SECUNDARIA',
			suggestedAmount: '580',
			defaultChecked: true,
			category: 'TUITION',
			recurringDefault: true,
		},
		{
			key: 'materials',
			name: 'Materiales / útiles',
			description: 'Cobro por materiales escolares',
			suggestedCode: 'MATERIALES',
			suggestedAmount: '80',
			defaultChecked: false,
			category: 'MATERIALS',
		},
		{
			key: 'meals',
			name: 'Refrigerio / almuerzo',
			description: 'Cuota por servicio de comida',
			suggestedCode: 'REFRIGERIO',
			suggestedAmount: '10',
			defaultChecked: false,
			category: 'MEALS',
		},
		{
			key: 'transport',
			name: 'Movilidad escolar',
			description: 'Servicio de transporte del estudiante',
			suggestedCode: 'MOVILIDAD',
			suggestedAmount: '180',
			defaultChecked: false,
			category: 'TRANSPORT',
		},
	];

	protected readonly autoCreateOptions = signal<readonly AutoCreateOption[]>(this.AUTO_CREATE_OPTIONS);
	protected readonly selectedOptions = signal<Set<string>>(
		new Set(this.AUTO_CREATE_OPTIONS.filter((option) => option.defaultChecked).map((option) => option.key)),
	);
	protected readonly allSelected = computed(
		() => this.autoCreateOptions().length > 0 && this.selectedOptions().size === this.autoCreateOptions().length,
	);
	protected readonly selectedCount = computed(() => this.selectedOptions().size);
	protected readonly selectedOptionsList = computed(() =>
		this.autoCreateOptions().filter((option) => this.selectedOptions().has(option.key)),
	);
	protected readonly saving = signal(false);
	protected readonly loading = signal(false);
	protected readonly concepts = signal<readonly PaymentConcept[]>([]);
	protected readonly banner = signal<{ ok: boolean; message: string } | null>(null);

	protected toggleOption(key: string): void {
		this.selectedOptions.update((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	protected toggleAllOptions(event: Event): void {
		const checked = (event.target as HTMLInputElement | null)?.checked ?? false;
		this.selectedOptions.set(
			checked ? new Set(this.autoCreateOptions().map((option) => option.key)) : new Set<string>(),
		);
	}

	protected readonly editing = signal<{ existing: PaymentConcept | null; editingExisting: boolean } | null>(null);
	protected readonly deleting = signal<PaymentConcept | null>(null);
	protected readonly formError = signal<string | null>(null);
	protected readonly deleteError = signal<string | null>(null);

	protected readonly form: FormGroup = this.fb.group({
		code: ['', [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9_]*$/), Validators.maxLength(40)]],
		name: ['', [Validators.required, Validators.maxLength(120)]],
		description: ['', Validators.maxLength(500)],
		category: ['TUITION' as PaymentConceptCategory, Validators.required],
		defaultAmountSoles: [0, [Validators.required, Validators.min(0)]],
		currency: ['PEN', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
		recurring: [false],
		active: [true],
		sortOrder: [0],
	});

	protected solesPreviewCents(): number {
		return solesToCents(Number(this.form.get('defaultAmountSoles')?.value) || 0);
	}

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
			defaultAmountSoles: 0,
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
			defaultAmountSoles: centsToSoles(concept.defaultAmountCents),
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

	async autoCreateConcepts(event?: Event): Promise<void> {
		event?.preventDefault();
		const options = this.selectedOptionsList();
		if (this.saving() || options.length === 0) {
			return;
		}
		this.saving.set(true);
		this.formError.set(null);

		try {
			const created: PaymentConcept[] = [];
			for (const option of options) {
				const payload: PaymentConceptRequest = {
					code: option.suggestedCode,
					name: option.name,
					description: '',
					category: option.category,
					defaultAmountCents: solesToCents(Number(option.suggestedAmount)),
					currency: 'PEN',
					recurring: option.recurringDefault ?? false,
					active: true,
					sortOrder: 0,
				};
				const createdConcept = await firstValueFrom(
					this.conceptsApi.create(payload)
				);
				created.push(createdConcept);
			}
			this.selectedOptions.set(new Set());
			this.banner.set({
				ok: true,
				message: `Se crearon ${created.length} concepto(s) de pago automáticamente.`,
			});
			await this.reload();
		}
		catch (err: unknown) {
			this.formError.set(this.extractError(err, 'No se pudieron crear todos los conceptos. Verifica cuáles se registraron antes de reintentar.'));
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
			defaultAmountCents: solesToCents(Number(v.defaultAmountSoles) || 0),
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
