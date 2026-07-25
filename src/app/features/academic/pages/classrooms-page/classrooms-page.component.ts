import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
	ChangeDetectionStrategy,
	Component,
	OnInit,
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
import {
	Classroom,
	ClassroomType,
	ClassroomRequest,
	ClassroomsApiService,
} from '../../services/classrooms-api.service';

/**
 * Sprint cierre-C / B4 — Classrooms admin page (TENANT_ADMIN).
 *
 * <p>CRUD sobre el catálogo de aulas físicas por tenant. La página se
 * monta en <code>/academic/classrooms</code> dentro del feature
 * académico y es la fuente de verdad para el campo
 * {@code time_slots.classroom_id} del schedule v2.</p>
 *
 * <p>UX coherente con la página de payment-concepts (cierre-C / F14):
 * tabla + drawer inline para create/edit + confirmación para delete.</p>
 */
@Component({
	selector: 'app-classrooms-page',
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
				eyebrow="Académico · Aulas"
				title="Aulas físicas"
				subtitle="Catálogo de aulas físicas por tenant. Los time-slots B4+ referencian este catálogo."
			>
				<button
					type="button"
					class="btn btn-primary btn-sm"
					(click)="openCreate()"
					data-testid="classrooms-new"
				>
					<app-icon name="plus" [size]="14" />
					<span>Nueva aula</span>
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

			@if (loading() && classrooms().length === 0) {
				<div class="flex items-center justify-center py-16">
					<app-spinner [size]="24" [label]="commonLabels.cargando()" />
				</div>
			} @else if (classrooms().length === 0) {
				<app-empty-state
					icon="building"
					title="Aún no hay aulas configuradas"
					description="Creá la primera aula (por ejemplo: A1) para empezar a asignar slots."
				/>
			} @else {
				<div class="card overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="border-b border-border bg-surface-muted text-left text-xs uppercase tracking-wide text-content-subtle">
								<tr>
									<th class="px-4 py-3 font-medium">Código</th>
									<th class="px-4 py-3 font-medium">Nombre</th>
									<th class="px-4 py-3 font-medium">Tipo</th>
									<th class="px-4 py-3 text-right font-medium">Capacidad</th>
									<th class="px-4 py-3 font-medium">Ubicación</th>
									<th class="px-4 py-3 text-right font-medium">Acciones</th>
								</tr>
							</thead>
							<tbody>
								@for (c of classrooms(); track c.publicUuid) {
									<tr class="border-b border-border last:border-b-0 hover:bg-surface-muted/40" data-testid="classroom-row">
										<td class="px-4 py-3 font-mono text-content">{{ c.code }}</td>
										<td class="px-4 py-3 font-medium text-content">{{ c.name }}</td>
										<td class="px-4 py-3">
											<span class="badge badge-info">{{ typeLabel(c.type) }}</span>
										</td>
										<td class="px-4 py-3 text-right tabular-nums">
											{{ c.capacity === null ? '—' : c.capacity }}
										</td>
										<td class="px-4 py-3 text-content-muted">{{ c.location ?? '—' }}</td>
										<td class="px-4 py-3 text-right">
											<button
												type="button"
												class="btn btn-ghost btn-xs"
												(click)="openEdit(c)"
												[attr.data-testid]="'classroom-edit-' + c.publicUuid"
											>
												<app-icon name="pencil" [size]="12" />
												<span>Editar</span>
											</button>
											<button
												type="button"
												class="btn btn-ghost btn-xs text-danger"
												(click)="confirmDelete(c)"
												[attr.data-testid]="'classroom-delete-' + c.publicUuid"
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

			@if (editing(); as draft) {
				<div class="card mt-6" data-testid="classroom-form">
					<header class="card-header flex items-center justify-between">
						<h2 class="card-title">{{ draft.existing ? 'Editar aula' : 'Nueva aula' }}</h2>
						<button
							type="button"
							class="btn btn-ghost btn-sm"
							(click)="cancelEdit()"
							aria-label="Cancelar"
						>
							<app-icon name="x" [size]="14" />
						</button>
					</header>
					<form [formGroup]="form" (ngSubmit)="submit()" class="card-body grid gap-4 sm:grid-cols-2">
						<div class="field">
							<label class="label">Código *</label>
							<p class="field-hint">Único por tenant; letras, dígitos, guion y guion bajo.</p>
						</div>
						<div class="field">
							<label class="label">Nombre *</label>
							<input type="text" class="input" formControlName="name" placeholder="Aula 1" maxlength="120" />
						</div>
						<div class="field">
							<label class="label">Tipo *</label>
							<select class="input" formControlName="type">
								@for (t of TYPES; track t.value) {
									<option [value]="t.value">{{ t.label }}</option>
								}
							</select>
						</div>
						<div class="field">
							<label class="label">Capacidad</label>
							<input type="number" class="input" formControlName="capacity" min="0" step="1" />
							<p class="field-hint">Vacío = capacidad desconocida.</p>
						</div>
						<div class="field sm:col-span-2">
							<label class="label">Ubicación</label>
							<input type="text" class="input" formControlName="location" placeholder="Piso 2, ala norte" maxlength="160" />
						</div>
						<div class="field sm:col-span-2">
							<label class="label">Descripción</label>
							<textarea class="input" formControlName="description" rows="2" maxlength="500"></textarea>
						</div>

						@if (formError(); as msg) {
							<div class="sm:col-span-2 text-sm text-danger" data-testid="classroom-form-error">{{ msg }}</div>
						}

						<footer class="flex justify-end gap-2 sm:col-span-2">
							<button type="button" class="btn btn-ghost btn-sm" (click)="cancelEdit()">{{ commonLabels.cancelar() }}</button>
							<button
								type="submit"
								class="btn btn-primary btn-sm"
								[disabled]="form.invalid || saving()"
								data-testid="classroom-save"
							>
								@if (saving()) {
									<app-spinner [size]="12" label="Guardando" />
									<span>Guardando…</span>
								} @else {
									<app-icon name="check" [size]="14" />
									<span>{{ draft.existing ? 'Guardar cambios' : 'Crear aula' }}</span>
								}
							</button>
						</footer>
					</form>
				</div>
			}

			@if (deleting(); as target) {
				<div class="card mt-6 border-l-4 border-l-danger">
					<header class="card-header">
						<h3 class="card-title text-danger">Eliminar aula</h3>
					</header>
					<div class="card-body">
						<p class="text-sm text-content">
							¿Eliminar <strong>{{ target.name }}</strong> ({{ target.code }})?
							Los time-slots que ya la referencian quedan huérfanos (B4 preserva la FK con ON DELETE RESTRICT).
						</p>
					</div>
					<footer class="card-header flex justify-end gap-2">
						<button type="button" class="btn btn-ghost btn-sm" (click)="cancelDelete()">{{ commonLabels.cancelar() }}</button>
						<button
							type="button"
							class="btn btn-danger btn-sm"
							(click)="doDelete()"
							[disabled]="saving()"
							data-testid="classroom-delete-confirm"
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
export class ClassroomsPageComponent implements OnInit {
	private readonly fb = inject(FormBuilder);
	private readonly api = inject(ClassroomsApiService);
	protected readonly commonLabels = inject(CommonLabels);

	protected readonly TYPES: readonly { value: ClassroomType; label: string }[] = [
		{ value: 'CLASSROOM', label: 'Aula' },
		{ value: 'LAB', label: 'Laboratorio' },
		{ value: 'GYM', label: 'Gimnasio' },
		{ value: 'LIBRARY', label: 'Biblioteca' },
		{ value: 'AUDITORIUM', label: 'Auditorio' },
		{ value: 'OUTDOOR', label: 'Exterior' },
		{ value: 'OTHER', label: 'Otro' },
	];

	protected readonly loading = signal(false);
	protected readonly saving = signal(false);
	protected readonly classrooms = signal<readonly Classroom[]>([]);
	protected readonly editing = signal<{ existing: Classroom | null } | null>(null);
	protected readonly deleting = signal<Classroom | null>(null);
	protected readonly formError = signal<string | null>(null);

	protected readonly form: FormGroup = this.fb.group({
		code: ['', [Validators.required, Validators.pattern(/^[A-Za-z][A-Za-z0-9_-]*$/), Validators.maxLength(40)]],
		name: ['', [Validators.required, Validators.maxLength(120)]],
		type: ['CLASSROOM' as ClassroomType, Validators.required],
		capacity: [null as number | null, [Validators.min(0)]],
		location: ['', Validators.maxLength(160)],
		description: ['', Validators.maxLength(500)],
	});

	async ngOnInit(): Promise<void> {
		await this.reload();
	}

	async reload(): Promise<void> {
		this.loading.set(true);
		try {
			const { items } = await firstValueFrom(this.api.list(0, 100));
			this.classrooms.set(items);
		}
		catch (err: unknown) {
			console.error('[classrooms] reload failed', err);
			this.classrooms.set([]);
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
			type: 'CLASSROOM',
			capacity: null,
			location: '',
			description: '',
		});
		this.editing.set({ existing: null });
	}

	openEdit(c: Classroom): void {
		this.deleting.set(null);
		this.formError.set(null);
		this.form.reset({
			code: c.code,
			name: c.name,
			type: c.type,
			capacity: c.capacity,
			location: c.location ?? '',
			description: c.description ?? '',
		});
		this.editing.set({ existing: c });
	}

	cancelEdit(): void {
		this.editing.set(null);
		this.formError.set(null);
	}

	confirmDelete(c: Classroom): void {
		this.editing.set(null);
		this.formError.set(null);
		this.deleting.set(c);
	}

	cancelDelete(): void {
		this.deleting.set(null);
	}

	async submit(): Promise<void> {
		if (this.form.invalid) return;
		const draft = this.editing();
		if (!draft) return;
		this.saving.set(true);
		this.formError.set(null);
		try {
			const payload = this.toRequest();
			if (draft.existing) {
				await firstValueFrom(this.api.update(draft.existing.publicUuid, payload));
			}
			else {
				await firstValueFrom(this.api.create(payload));
			}
			this.editing.set(null);
			await this.reload();
		}
		catch (err: unknown) {
			this.formError.set(this.extractError(err, 'No se pudo guardar el aula.'));
		}
		finally {
			this.saving.set(false);
		}
	}

	async doDelete(): Promise<void> {
		const target = this.deleting();
		if (!target) return;
		this.saving.set(true);
		this.formError.set(null);
		try {
			await firstValueFrom(this.api.softDelete(target.publicUuid));
			this.deleting.set(null);
			await this.reload();
		}
		catch (err: unknown) {
			this.formError.set(this.extractError(err, 'No se pudo eliminar el aula.'));
		}
		finally {
			this.saving.set(false);
		}
	}

	private toRequest(): ClassroomRequest {
		const v = this.form.getRawValue();
		return {
			code: String(v.code ?? '').trim(),
			name: String(v.name ?? '').trim(),
			type: v.type as ClassroomType,
			capacity: v.capacity == null || v.capacity === '' ? null : Number(v.capacity),
			location: (v.location ?? '').toString().trim() || null,
			description: (v.description ?? '').toString().trim() || null,
		};
	}

	private extractError(err: unknown, fallback: string): string {
		if (err instanceof HttpErrorResponse) {
			const apiErr = (err.error as { error?: { message?: string }; message?: string } | null | undefined);
			return apiErr?.error?.message ?? apiErr?.message ?? fallback;
		}
		return fallback;
	}

	typeLabel(t: string): string {
		const opt = this.TYPES.find((x) => x.value === t);
		return opt?.label ?? t;
	}
}