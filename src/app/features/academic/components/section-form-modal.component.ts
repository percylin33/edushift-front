import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicStore } from '../store';
import {
  AcademicLevel,
  AcademicYearRow,
  AcademicYearStatus,
  Grade,
  SectionDetail,
  isYearActivatable
} from '../models';

/**
 * Modal de creación/edición de {@link SectionDetail}.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Si {@link #section} es {@code null} ⇒ modo create (POST). Los
 *       selectores Year/Level/Grade están abiertos al usuario.</li>
 *   <li>Si trae una sección ⇒ modo edit (PUT partial-merge). El backend
 *       no permite mover la sección a otro {@code (year, grade)} así que
 *       deshabilitamos esos selectores (el usuario los ve para
 *       contexto pero no los puede cambiar).</li>
 * </ul>
 *
 * <h3>Cascada Level → Grade</h3>
 * Cuando el usuario elige un level, el dropdown de grade se filtra a
 * los grades de ese level. Si el grade actualmente seleccionado ya no
 * pertenece al level, se limpia. Implementado con un {@code effect()}
 * sobre el signal de level seleccionado.
 *
 * <h3>Validación</h3>
 * Espejea {@code CreateSectionRequest}:
 * <ul>
 *   <li>{@code academicYearPublicUuid} y {@code gradePublicUuid}: requeridos.</li>
 *   <li>{@code name}: 1..40, único en {@code (year, grade)} (server check).</li>
 *   <li>{@code capacity}: opcional, entero positivo.</li>
 * </ul>
 */
@Component({
  selector: 'app-section-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IconComponent,
    SpinnerComponent
  ],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-form-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-xl shadow-xl" (click)="$event.stopPropagation()">
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="section-form-title" class="card-title">{{ title() }}</h2>
            <p class="card-description">
              Una sección representa una "letra" (A, B, C…) dentro de un grado y año.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            aria-label="Cerrar"
            (click)="cancel()"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card-body grid gap-4">
          @if (errorBanner(); as err) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ err }}</p>
            </div>
          }

          <div class="grid gap-4 sm:grid-cols-12">
            <div class="field sm:col-span-12">
              <label class="label" for="section-year">Año académico *</label>
              <select
                id="section-year"
                class="select"
                formControlName="academicYearPublicUuid"
              >
                <option [ngValue]="null" disabled>Selecciona un año…</option>
                @for (y of activatableYears(); track y.publicUuid) {
                  <option [ngValue]="y.publicUuid">
                    {{ y.name }} · {{ statusLabel(y.status) }}
                  </option>
                }
              </select>
              @if (showError('academicYearPublicUuid'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else if (editing()) {
                <p class="field-hint">
                  El año no se puede modificar después de crear la sección.
                </p>
              } @else {
                <p class="field-hint">
                  Solo se listan años en estado <code>PLANNING</code> o <code>ACTIVE</code>.
                </p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="section-level">Nivel *</label>
              <select
                id="section-level"
                class="select"
                [disabled]="editing()"
                [ngModel]="selectedLevelId()"
                [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="onLevelChange($event)"
              >
                <option [ngValue]="null" disabled>Selecciona un nivel…</option>
                @for (l of levels(); track l.publicUuid) {
                  <option [ngValue]="l.publicUuid">{{ l.name }}</option>
                }
              </select>
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="section-grade">Grado *</label>
              <select
                id="section-grade"
                class="select"
                formControlName="gradePublicUuid"
              >
                <option [ngValue]="null" disabled>Selecciona un grado…</option>
                @for (g of gradesForSelectedLevel(); track g.publicUuid) {
                  <option [ngValue]="g.publicUuid">{{ g.name }}</option>
                }
              </select>
              @if (showError('gradePublicUuid'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="section-name">Nombre *</label>
              <input
                id="section-name"
                type="text"
                class="input uppercase"
                formControlName="name"
                maxlength="40"
                placeholder="A"
              />
              @if (showError('name'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">
                  Sugerencia: la próxima letra disponible para el grado seleccionado.
                </p>
              }
            </div>

            <div class="field sm:col-span-6">
              <label class="label" for="section-capacity">Capacidad</label>
              <input
                id="section-capacity"
                type="number"
                class="input"
                formControlName="capacity"
                min="1"
                step="1"
                placeholder="30"
              />
              @if (showError('capacity'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">
                  Entero ≥ 1. Opcional. Se usará como cupo máximo de matrícula.
                </p>
              }
            </div>
          </div>

          <footer class="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">
              Cancelar
            </button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="form.invalid || saving()"
            >
              @if (saving()) {
                <app-spinner [size]="14" label="Guardando" />
                <span>Guardando…</span>
              } @else {
                <span>{{ submitLabel() }}</span>
                <app-icon name="check" [size]="16" />
              }
            </button>
          </footer>
        </form>
      </div>
    </div>
  `
})
export class SectionFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AcademicStore);

  readonly section = input<SectionDetail | null>(null);
  /** Filtros vigentes en la lista — usados para preseleccionar dropdowns. */
  readonly defaultYearUuid = input<string | null>(null);
  readonly defaultGradeUuid = input<string | null>(null);
  readonly defaultLevelUuid = input<string | null>(null);

  readonly closed = output<void>();
  readonly saved = output<SectionDetail>();

  protected readonly years = this.store.years;
  protected readonly levels = this.store.levels;
  protected readonly saving = this.store.savingSection;
  protected readonly errorBanner = this.store.error;

  protected readonly editing = computed(() => this.section() !== null);
  protected readonly title = computed(() =>
    this.editing() ? 'Editar sección' : 'Nueva sección'
  );
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear sección'
  );

  /**
   * Solo años en {@code PLANNING}/{@code ACTIVE} pueden recibir
   * mutaciones (BE rechaza con 409 {@code ACADEMIC_YEAR_LOCKED} sobre
   * {@code CLOSED}). En modo edit incluimos siempre el año actual de
   * la sección aunque esté CLOSED, para que el dropdown lo muestre.
   */
  protected readonly activatableYears = computed<AcademicYearRow[]>(() => {
    const list = this.years();
    const sec = this.section();
    if (sec) {
      return list.filter(
        (y) =>
          isYearActivatable(y.status) ||
          y.publicUuid === sec.academicYearPublicUuid
      );
    }
    return list.filter((y) => isYearActivatable(y.status));
  });

  /** Level seleccionado (signal independiente del form para la cascada). */
  protected readonly selectedLevelId = signal<string | null>(null);

  protected readonly gradesForSelectedLevel = computed<Grade[]>(() => {
    const id = this.selectedLevelId();
    if (!id) return [];
    return (
      this.levels()
        .find((l) => l.publicUuid === id)
        ?.grades.slice()
        .sort((a, b) => a.ordinal - b.ordinal) ?? []
    );
  });

  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form: FormGroup = this.fb.group({
    academicYearPublicUuid: [null as string | null, [Validators.required]],
    gradePublicUuid: [null as string | null, [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(40)]],
    capacity: [null as number | null, [Validators.min(1)]]
  });

  constructor() {
    /* Cuando cambia el level seleccionado, valida que el grade del
     * form siga perteneciendo a ese level — si no, lo limpia. Evita
     * payloads incoherentes (level=PRIMARIA + grade de SECUNDARIA). */
    effect(() => {
      const grades = this.gradesForSelectedLevel();
      const currentGradeId = this.form.get('gradePublicUuid')?.value as string | null;
      if (currentGradeId && !grades.some((g) => g.publicUuid === currentGradeId)) {
        this.form.patchValue({ gradePublicUuid: null });
      }
    });
  }

  ngOnInit(): void {
    this.store.clearError();
    const sec = this.section();
    if (sec) {
      this.selectedLevelId.set(sec.levelPublicUuid);
      this.form.patchValue({
        academicYearPublicUuid: sec.academicYearPublicUuid,
        gradePublicUuid: sec.gradePublicUuid,
        name: sec.name,
        capacity: sec.capacity ?? null
      });
      /* En edición, year y grade son inmutables: el backend rechaza
       * mover una sección entre tuplas (year, grade). Los dejamos
       * visibles para contexto pero deshabilitados en el form. */
      this.form.get('academicYearPublicUuid')?.disable();
      this.form.get('gradePublicUuid')?.disable();
    } else {
      this.hydrateDefaults();
    }
  }

  /**
   * Pre-rellena el form con los filtros activos de la lista (year,
   * level, grade). Si no hay year filtrado, usa el {@code ACTIVE}.
   * También dispara el {@code suggestSectionName} si ya hay grade.
   */
  private hydrateDefaults(): void {
    const yearId = this.defaultYearUuid() ?? this.store.currentActive()?.publicUuid ?? null;
    const levelId = this.defaultLevelUuid() ?? null;
    const gradeId = this.defaultGradeUuid() ?? null;

    /* Si nos dieron grade pero no level, deducimos el level desde el
     * catálogo cargado en memoria. */
    let resolvedLevelId = levelId;
    if (gradeId && !resolvedLevelId) {
      const owner = this.levels().find((l) =>
        l.grades.some((g) => g.publicUuid === gradeId)
      );
      resolvedLevelId = owner?.publicUuid ?? null;
    }
    this.selectedLevelId.set(resolvedLevelId);

    this.form.patchValue({
      academicYearPublicUuid: yearId,
      gradePublicUuid: gradeId
    });

    if (yearId && gradeId) {
      this.form.patchValue({
        name: this.store.suggestSectionName(yearId, gradeId)
      });
    }
  }

  protected onLevelChange(value: string): void {
    this.selectedLevelId.set(value || null);
    /* No tocamos gradePublicUuid aquí: el effect() lo limpia si el
     * grade actual deja de ser válido. */
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const sec = this.section();
    const capacity = this.optionalPositive(v.capacity);

    try {
      if (sec) {
        const updated = await this.store.updateSection(sec.publicUuid, {
          name: v.name?.trim(),
          capacity
        });
        if (updated) this.saved.emit(updated);
      } else {
        const created = await this.store.createSection({
          academicYearPublicUuid: v.academicYearPublicUuid as string,
          gradePublicUuid: v.gradePublicUuid as string,
          name: (v.name ?? '').trim(),
          capacity
        });
        if (created) this.saved.emit(created);
      }
    }
    catch (err) {
      this.applyServerErrors(err);
    }
  }

  protected cancel(): void {
    this.store.clearError();
    this.closed.emit();
  }

  protected statusLabel(status: AcademicYearStatus): string {
    switch (status) {
      case AcademicYearStatus.Planning: return 'Planificación';
      case AcademicYearStatus.Active:   return 'Activo';
      case AcademicYearStatus.Closed:   return 'Cerrado';
    }
  }

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl) return null;

    const serverErr = this.fieldErrors()[controlName];
    if (serverErr) return serverErr;

    if (!ctrl.touched && !ctrl.dirty) return null;
    if (!ctrl.errors) return null;
    if (ctrl.errors['required']) return 'Campo requerido.';
    if (ctrl.errors['maxlength']) {
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors['min']) return 'Debe ser ≥ 1.';
    return 'Valor inválido.';
  }

  /**
   * El backend rechaza {@code capacity = 0} con validation; "limpiar"
   * el cupo se hace omitiendo el campo. Convertimos {@code null}/0 a
   * {@code undefined} para que la serialización JSON omita la clave.
   */
  private optionalPositive(value: number | null | undefined): number | undefined {
    if (value === null || value === undefined) return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 ? n : undefined;
  }

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    switch (apiErr.code) {
      case 'SECTION_NAME_TAKEN':
        next['name'] = 'Ya existe una sección con este nombre en el mismo grado.';
        break;
      case 'ACADEMIC_YEAR_LOCKED':
        next['academicYearPublicUuid'] =
          'El año académico está cerrado. Elige otro año o reabre el actual.';
        break;
      default:
        break;
    }
    this.fieldErrors.set(next);
  }
}
