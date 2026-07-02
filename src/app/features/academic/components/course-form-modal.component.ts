import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '@core/models';
import {
  ChipMultiSelectComponent,
  ChipOption,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';
import { AcademicStore } from '../store';
import {
  COURSE_CODE_MAX_LENGTH,
  COURSE_CODE_REGEX,
  COURSE_DESCRIPTION_MAX_LENGTH,
  COURSE_NAME_MAX_LENGTH,
  CourseDetail,
  UpdateCourseRequest,
} from '../models';

/**
 * Modal de creación/edición de un {@link CourseDetail}.
 *
 * <h3>Submit dual (edición)</h3>
 * El backend separa el patch del entity (PUT) del replace de levels
 * (POST /levels). El componente computa el diff y dispara solo lo
 * necesario:
 * <ul>
 *   <li>Si cambian campos escalares ⇒ {@code PUT /courses/{uuid}}.</li>
 *   <li>Si la lista de levels difiere ⇒ {@code POST /courses/{uuid}/levels}.</li>
 *   <li>Ambos cambios ⇒ ambas llamadas en orden (PATCH primero,
 *       luego replace de levels) — el spec FE-4.4 lo pide.</li>
 * </ul>
 *
 * <h3>Validación client-side</h3>
 * Espejea el DTO BE:
 * <ul>
 *   <li>{@code code}: requerido, 1..30, regex
 *       {@link COURSE_CODE_REGEX}. UI fuerza UPPERCASE en blur.</li>
 *   <li>{@code name}: requerido, 1..200.</li>
 *   <li>{@code description}: opcional, max 4000.</li>
 *   <li>{@code credits} y {@code hoursPerWeek}: opcionales,
 *       {@code >= 0}.</li>
 *   <li>{@code levels}: requerido, ≥ 1 (invariant
 *       {@code COURSE_NEEDS_AT_LEAST_ONE_LEVEL}).</li>
 * </ul>
 */
@Component({
  selector: 'app-course-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ChipMultiSelectComponent,
    IconComponent,
    SpinnerComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-form-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="course-form-title" class="card-title">{{ title() }}</h2>
            <p class="card-description">
              Catálogo de cursos del workspace. Cada curso se asocia a uno o más niveles para que
              aparezca en la matriz de asignaciones.
            </p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Cerrar" (click)="cancel()">
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
            <div class="field sm:col-span-4">
              <label class="label" for="course-code">Código *</label>
              <input
                id="course-code"
                type="text"
                class="input font-mono uppercase"
                formControlName="code"
                [maxLength]="codeMaxLength"
                placeholder="MAT"
                (blur)="forceUppercase('code')"
              />
              @if (showError('code'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">
                  Letras, dígitos y "_". Empieza con letra. Se guarda en mayúsculas.
                </p>
              }
            </div>

            <div class="field sm:col-span-8">
              <label class="label" for="course-name">Nombre *</label>
              <input
                id="course-name"
                type="text"
                class="input"
                formControlName="name"
                [maxLength]="nameMaxLength"
                placeholder="Matemática"
              />
              @if (showError('name'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field sm:col-span-12">
              <label class="label" for="course-description">Descripción</label>
              <textarea
                id="course-description"
                class="input min-h-[80px]"
                formControlName="description"
                [maxLength]="descriptionMaxLength"
                placeholder="Breve descripción opcional…"
              ></textarea>
              @if (showError('description'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field sm:col-span-3">
              <label class="label" for="course-credits">Créditos</label>
              <input
                id="course-credits"
                type="number"
                class="input"
                formControlName="credits"
                min="0"
                step="1"
                placeholder="0"
              />
              @if (showError('credits'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field sm:col-span-3">
              <label class="label" for="course-hours">Horas/semana</label>
              <input
                id="course-hours"
                type="number"
                class="input"
                formControlName="hoursPerWeek"
                min="0"
                step="1"
                placeholder="0"
              />
              @if (showError('hoursPerWeek'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field flex items-end sm:col-span-6">
              <label class="inline-flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  class="size-4 rounded border-border accent-primary-600"
                  formControlName="isActive"
                />
                <span class="text-sm">
                  Activo
                  <span class="ml-1 text-xs text-content-muted">
                    (los cursos inactivos no aparecen en asignaciones)
                  </span>
                </span>
              </label>
            </div>

            <div class="field sm:col-span-12">
              <label class="label" for="course-levels">Niveles *</label>
              <app-chip-multi-select
                id="course-levels"
                formControlName="levelIds"
                [options]="levelOptions()"
                placeholder="Selecciona los niveles donde se dicta el curso…"
                emptyText="No hay niveles que coincidan"
              />
              @if (showError('levelIds'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">
                  Mínimo 1 nivel requerido. La cascada de levels se aplica al guardar (replace, no
                  add).
                </p>
              }
            </div>
          </div>

          <footer class="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">Cancelar</button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="form.invalid || saving() || !hasChanges()"
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
  `,
})
export class CourseFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AcademicStore);

  readonly course = input<CourseDetail | null>(null);

  readonly closed = output<void>();
  readonly saved = output<CourseDetail>();

  protected readonly levels = this.store.levels;
  protected readonly saving = this.store.savingCourse;
  protected readonly errorBanner = this.store.error;

  protected readonly codeMaxLength = COURSE_CODE_MAX_LENGTH;
  protected readonly nameMaxLength = COURSE_NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = COURSE_DESCRIPTION_MAX_LENGTH;

  protected readonly editing = computed(() => this.course() !== null);
  protected readonly title = computed(() => (this.editing() ? 'Editar curso' : 'Nuevo curso'));
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear curso',
  );

  /** Adapta los levels al shape esperado por chip-multi-select. */
  protected readonly levelOptions = computed<ChipOption[]>(() =>
    this.levels()
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((l) => ({
        id: l.publicUuid,
        label: l.name,
        subtitle: l.code,
      })),
  );

  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form: FormGroup = this.fb.group({
    code: [
      '',
      [
        Validators.required,
        Validators.maxLength(COURSE_CODE_MAX_LENGTH),
        Validators.pattern(COURSE_CODE_REGEX),
      ],
    ],
    name: ['', [Validators.required, Validators.maxLength(COURSE_NAME_MAX_LENGTH)]],
    description: ['', [Validators.maxLength(COURSE_DESCRIPTION_MAX_LENGTH)]],
    credits: [null as number | null, [Validators.min(0)]],
    hoursPerWeek: [null as number | null, [Validators.min(0)]],
    isActive: [true],
    levelIds: [[] as string[], [Validators.required, atLeastOneLevel()]],
  });

  /** Snapshot del estado original — usado para detectar cambios. */
  private original: {
    code: string;
    name: string;
    description: string;
    credits: number | null;
    hoursPerWeek: number | null;
    isActive: boolean;
    levelIds: string[];
  } | null = null;

  /**
   * {@code true} sii hay al menos un campo modificado vs. el snapshot.
   * En modo create siempre es {@code true} (el form arranca "vacío"
   * pero al guardar se materializa). En modo edit, se usa para
   * deshabilitar el submit y evitar PUTs no-op.
   */
  protected readonly hasChanges = computed<boolean>(() => {
    if (!this.editing()) return true;
    const orig = this.original;
    if (!orig) return true;
    const v = this.form.getRawValue();
    if (orig.code !== (v.code ?? '').trim().toUpperCase()) return true;
    if (orig.name !== (v.name ?? '').trim()) return true;
    if ((orig.description ?? '') !== (v.description ?? '').trim()) return true;
    if (orig.credits !== this.normalizeNullableInt(v.credits)) return true;
    if (orig.hoursPerWeek !== this.normalizeNullableInt(v.hoursPerWeek)) return true;
    if (orig.isActive !== Boolean(v.isActive)) return true;
    if (!sameSet(orig.levelIds, v.levelIds ?? [])) return true;
    return false;
  });

  ngOnInit(): void {
    this.store.clearError();

    /* Asegura que los niveles estén cargados (el caller ya invoca
     * `loadLevels` desde la lista, pero somos defensivos). */
    if (this.levels().length === 0) {
      void this.store.loadLevels();
    }

    const c = this.course();
    if (c) {
      const levelIds = c.levels.map((l) => l.publicUuid);
      this.form.patchValue({
        code: c.code,
        name: c.name,
        description: c.description ?? '',
        credits: c.credits ?? null,
        hoursPerWeek: c.hoursPerWeek ?? null,
        isActive: c.isActive,
        levelIds,
      });
      this.original = {
        code: c.code,
        name: c.name,
        description: c.description ?? '',
        credits: c.credits ?? null,
        hoursPerWeek: c.hoursPerWeek ?? null,
        isActive: c.isActive,
        levelIds: [...levelIds].sort(),
      };
    }
  }

  // ===========================================================================
  // Form actions
  // ===========================================================================

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }

  protected cancel(): void {
    this.store.clearError();
    this.closed.emit();
  }

  /** Force-uppercase el code en blur (UX afín a "auto-uppercase" del spec). */
  protected forceUppercase(controlName: 'code'): void {
    const ctrl = this.form.get(controlName);
    if (!ctrl) return;
    const v = (ctrl.value ?? '') as string;
    const next = v.trim().toUpperCase();
    if (v !== next) ctrl.setValue(next);
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const code = (v.code ?? '').trim().toUpperCase();
    const name = (v.name ?? '').trim();
    const description = (v.description ?? '').trim();
    const credits = this.normalizeNullableInt(v.credits);
    const hoursPerWeek = this.normalizeNullableInt(v.hoursPerWeek);
    const isActive = Boolean(v.isActive);
    const levelIds: string[] = v.levelIds ?? [];

    const c = this.course();
    try {
      if (c) {
        const patch: UpdateCourseRequest = {};
        if (this.original) {
          if (code !== this.original.code) patch.code = code;
          if (name !== this.original.name) patch.name = name;
          if (description !== (this.original.description ?? '')) {
            patch.description = description;
          }
          if (credits !== this.original.credits) {
            patch.credits = credits ?? undefined;
          }
          if (hoursPerWeek !== this.original.hoursPerWeek) {
            patch.hoursPerWeek = hoursPerWeek ?? undefined;
          }
          if (isActive !== this.original.isActive) patch.isActive = isActive;
        }

        const levelsChanged = !!this.original && !sameSet(this.original.levelIds, levelIds);

        const updated = await this.store.updateCourse(c.publicUuid, {
          patch: Object.keys(patch).length > 0 ? patch : undefined,
          levels: levelsChanged ? { levelPublicUuids: levelIds } : undefined,
        });
        if (updated) this.saved.emit(updated);
      } else {
        const created = await this.store.createCourse({
          code,
          name,
          description: description || undefined,
          credits: credits ?? undefined,
          hoursPerWeek: hoursPerWeek ?? undefined,
          isActive,
          levelPublicUuids: levelIds,
        });
        if (created) this.saved.emit(created);
      }
    } catch (err) {
      this.applyServerErrors(err);
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl) return null;

    const serverErr = this.fieldErrors()[controlName];
    if (serverErr) return serverErr;

    if (!ctrl.touched && !ctrl.dirty) return null;
    if (!ctrl.errors) return null;
    if (ctrl.errors['required']) return 'Campo requerido.';
    if (ctrl.errors['minLevels']) return 'Debes seleccionar al menos un nivel.';
    if (ctrl.errors['maxlength']) {
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors['pattern']) {
      return 'Solo letras, dígitos y "_". Debe empezar con letra.';
    }
    if (ctrl.errors['min']) return 'Debe ser ≥ 0.';
    return 'Valor inválido.';
  }

  private normalizeNullableInt(value: number | null | undefined): number | null {
    if (value === null || value === undefined || value === ('' as unknown as number)) return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
  }

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    switch (apiErr.code) {
      case 'COURSE_CODE_TAKEN':
        next['code'] =
          'Ya existe un curso con este código. Usa otro código (ej. ' +
          this.suggestNextCode() +
          ').';
        break;
      case 'COURSE_NEEDS_AT_LEAST_ONE_LEVEL':
        next['levelIds'] = 'Debes seleccionar al menos un nivel.';
        break;
      case 'RESOURCE_NOT_FOUND':
        next['levelIds'] = 'Uno de los niveles seleccionados ya no existe. Refresca la lista.';
        break;
      case 'COURSE_IN_USE_BY_ASSIGNMENTS':
        /* No aplica al form pero por completitud. */
        break;
      default:
        break;
    }
    this.fieldErrors.set(next);
  }

  /**
   * Sugerencia trivial para colisión de code: añade "_2", "_3"… al
   * code base hasta encontrar uno libre en el set ya cargado en el
   * store. Como la lista se filtra server-side por level/isActive,
   * puede no ser exhaustiva — pero el server validará igual.
   */
  private suggestNextCode(): string {
    const ctrl = this.form.get('code');
    const base = ((ctrl?.value as string) ?? 'X').trim().toUpperCase();
    const existing = new Set(this.store.courses().map((c) => c.code.toUpperCase()));
    if (!existing.has(base)) return base;
    for (let i = 2; i < 100; i++) {
      const candidate = `${base}_${i}`;
      if (!existing.has(candidate)) return candidate;
    }
    return `${base}_NEW`;
  }
}

// =============================================================================
// Local helpers
// =============================================================================

/** Validator: la lista debe tener al menos 1 elemento. */
function atLeastOneLevel() {
  return (control: { value: unknown }): { minLevels: true } | null => {
    const v = control.value;
    if (Array.isArray(v) && v.length >= 1) return null;
    return { minLevels: true };
  };
}

/** Compara dos listas de ids como sets (ignora orden y duplicados). */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    /* `a` es el snapshot ya ordenado; `b` puede traer repetidos del
     * value, aunque chip-multi-select no los introduce. Comparamos
     * tras dedupe para ser conservadores. */
    const sa = new Set(a);
    const sb = new Set(b);
    if (sa.size !== sb.size) return false;
    for (const id of sa) if (!sb.has(id)) return false;
    return true;
  }
  const sa = new Set(a);
  for (const id of b) if (!sa.has(id)) return false;
  return true;
}
