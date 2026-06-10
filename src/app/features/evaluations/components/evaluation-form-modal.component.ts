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
  signal
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { EvaluationsStore } from '../store';
import {
  ALLOWED_SCALES_BY_KIND,
  CreateEvaluationRequest,
  EVALUATION_KIND_LABELS,
  EVALUATION_SCALE_LABELS,
  EvaluationDetail,
  EvaluationKind,
  EvaluationScale,
  EvaluationStatus,
  UpdateEvaluationRequest
} from '../models';

const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 4000;
const WEIGHT_MIN = 0;
const WEIGHT_MAX = 999.99;

/**
 * Modal de creación / edición de {@link EvaluationDetail} (FE-5B.1).
 *
 * <h3>Modos</h3>
 * <ul>
 *   <li>{@link #evaluation} {@code null} ⇒ create. Requiere
 *       {@link #assignmentUuid}.</li>
 *   <li>{@link #evaluation} presente ⇒ edit. La <em>editability matrix</em>
 *       (DRAFT / PUBLISHED / CLOSED) se enforce server-side; en el FE
 *       deshabilitamos los inputs no editables para una UX honesta.</li>
 * </ul>
 *
 * <h3>Validación cliente (espejo del BE)</h3>
 * <ul>
 *   <li>{@code name}: requerido, 1..200, único en el assignment (server).</li>
 *   <li>{@code description}: opcional, max 4000.</li>
 *   <li>{@code weight}: requerido, [0, 999.99] con 2 decimales.</li>
 *   <li>{@code scheduledDate}: requerido, debe ser ≤ hoy
 *       (`@PastOrPresent` server-side).</li>
 *   <li>{@code dueDate}: opcional, ≥ scheduledDate cuando ambos presentes
 *       ({@code EVAL_DATE_INVERTED}).</li>
 *   <li>{@code kind × scale}: matriz {@link ALLOWED_SCALES_BY_KIND}; el
 *       `<select>` de scale se filtra al cambiar kind para imposibilitar
 *       combinaciones inválidas client-side ({@code EVAL_KIND_SCALE_MISMATCH}).</li>
 * </ul>
 *
 * <p>El initial status de una evaluation creada es siempre {@code DRAFT}
 * (BE-5B.1, ADR-5B.7) — no se ofrece selector de status. Los lifecycle
 * hops se hacen desde la fila del listing (botones Publish / Close).</p>
 */
@Component({
  selector: 'app-evaluation-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evaluation-form-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="evaluation-form-title" class="card-title">{{ title() }}</h2>
            <p class="card-description">
              @if (editing()) {
                Edita los campos permitidos por el ciclo de vida actual.
                Los campos en gris solo se pueden cambiar en estado
                <strong>Borrador</strong>.
              } @else {
                Crea una evaluación borrador. Podrás publicarla más tarde
                desde el listado.
              }
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

          <!-- Kind + Scale -->
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="field">
              <label class="label" for="evaluation-kind">Tipo *</label>
              <select
                id="evaluation-kind"
                class="input"
                formControlName="kind"
              >
                @for (k of kinds; track k) {
                  <option [value]="k">{{ kindLabel(k) }}</option>
                }
              </select>
              @if (showError('kind'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field">
              <label class="label" for="evaluation-scale">Escala *</label>
              <select
                id="evaluation-scale"
                class="input"
                formControlName="scale"
              >
                @for (s of allowedScales(); track s) {
                  <option [value]="s">{{ scaleLabel(s) }}</option>
                }
              </select>
              @if (showError('scale'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">Filtrada según el tipo elegido.</p>
              }
            </div>
          </div>

          <!-- Name -->
          <div class="field">
            <label class="label" for="evaluation-name">Nombre *</label>
            <input
              id="evaluation-name"
              type="text"
              class="input"
              formControlName="name"
              [maxlength]="nameMaxLength"
              placeholder="Práctica 1 — Ecuaciones lineales"
              autocomplete="off"
            />
            @if (showError('name'); as msg) {
              <p class="field-error">{{ msg }}</p>
            } @else {
              <p class="field-hint">
                Único dentro de esta asignación (no diferencia mayúsculas).
              </p>
            }
          </div>

          <!-- Description -->
          <div class="field">
            <label class="label" for="evaluation-description">Descripción</label>
            <textarea
              id="evaluation-description"
              class="input"
              formControlName="description"
              rows="3"
              [maxlength]="descriptionMaxLength"
              placeholder="Detalle pedagógico u observaciones internas."
            ></textarea>
            @if (showError('description'); as msg) {
              <p class="field-error">{{ msg }}</p>
            }
          </div>

          <!-- Weight + Dates -->
          <div class="grid gap-4 sm:grid-cols-3">
            <div class="field">
              <label class="label" for="evaluation-weight">Peso *</label>
              <input
                id="evaluation-weight"
                type="number"
                step="0.01"
                min="0"
                max="999.99"
                class="input"
                formControlName="weight"
                placeholder="25"
              />
              @if (showError('weight'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">0 a 999.99</p>
              }
            </div>

            <div class="field">
              <label class="label" for="evaluation-scheduled">Fecha *</label>
              <input
                id="evaluation-scheduled"
                type="date"
                class="input"
                formControlName="scheduledDate"
                [max]="todayIso"
              />
              @if (showError('scheduledDate'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field">
              <label class="label" for="evaluation-due">Entrega</label>
              <input
                id="evaluation-due"
                type="date"
                class="input"
                formControlName="dueDate"
              />
              @if (showError('dueDate'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">Opcional</p>
              }
            </div>
          </div>

          @if (showFormError(); as msg) {
            <p class="field-error -mt-2">{{ msg }}</p>
          }

          <!-- Anchors (only on edit; create them later from detail) -->
          @if (editing()) {
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="field">
                <label class="label" for="evaluation-unit">Unidad anclada</label>
                <input
                  id="evaluation-unit"
                  type="text"
                  class="input"
                  formControlName="unitPublicUuid"
                  placeholder="UUID de la unidad (opcional)"
                  autocomplete="off"
                />
                <p class="field-hint">
                  Vacío para desanclar. La unidad debe pertenecer al
                  mismo curso que esta asignación.
                </p>
              </div>
              <div class="field">
                <label class="label" for="evaluation-session">
                  Sesión anclada
                </label>
                <input
                  id="evaluation-session"
                  type="text"
                  class="input"
                  formControlName="learningSessionPublicUuid"
                  placeholder="UUID de la sesión (opcional)"
                  autocomplete="off"
                />
                <p class="field-hint">
                  Vacío para desanclar. La sesión debe pertenecer a esta
                  asignación.
                </p>
              </div>
            </div>

            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" formControlName="isActive" />
              <span>Evaluación activa</span>
              <span class="text-xs text-content-muted">
                (las inactivas siguen visibles para el docente pero
                no aparecen en cómputos por defecto)
              </span>
            </label>
          }

          <footer class="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">
              Cancelar
            </button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="form.invalid || saving() || isReadOnly()"
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
export class EvaluationFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(EvaluationsStore);

  /** {@code null} ⇒ create. */
  readonly evaluation = input<EvaluationDetail | null>(null);
  /** Requerido en modo create. Ignorado en edit. */
  readonly assignmentUuid = input<string | null>(null);

  readonly closed = output<void>();
  readonly saved = output<EvaluationDetail>();

  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;

  protected readonly editing = computed(() => this.evaluation() !== null);
  protected readonly title = computed(() =>
    this.editing() ? 'Editar evaluación' : 'Nueva evaluación'
  );
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear borrador'
  );
  protected readonly isReadOnly = computed(
    () => this.evaluation()?.status === EvaluationStatus.CLOSED
  );

  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;
  protected readonly todayIso = new Date().toISOString().slice(0, 10);

  protected readonly kinds: EvaluationKind[] = [
    EvaluationKind.TASK,
    EvaluationKind.QUIZ,
    EvaluationKind.EXAM,
    EvaluationKind.RUBRIC,
    EvaluationKind.COMPETENCY
  ];

  /** Subset de scales válidas según el kind activo en el form. */
  protected readonly allowedScales = signal<EvaluationScale[]>(
    ALLOWED_SCALES_BY_KIND[EvaluationKind.TASK]
  );

  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form: FormGroup = this.fb.group(
    {
      kind: [EvaluationKind.TASK, [Validators.required]],
      scale: [EvaluationScale.SCORE_0_20, [Validators.required]],
      name: ['', [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
      description: ['', [Validators.maxLength(DESCRIPTION_MAX_LENGTH)]],
      weight: [
        25,
        [
          Validators.required,
          Validators.min(WEIGHT_MIN),
          Validators.max(WEIGHT_MAX)
        ]
      ],
      scheduledDate: [this.todayIso, [Validators.required]],
      dueDate: [''],
      unitPublicUuid: [''],
      learningSessionPublicUuid: [''],
      isActive: [true]
    },
    { validators: [dateRangeValidator] }
  );

  ngOnInit(): void {
    this.store.clearError();
    const e = this.evaluation();
    if (e) {
      this.allowedScales.set(ALLOWED_SCALES_BY_KIND[e.kind]);
      this.form.patchValue({
        kind: e.kind,
        scale: e.scale,
        name: e.name,
        description: e.description ?? '',
        weight: e.weight,
        scheduledDate: toDateInput(e.scheduledDate),
        dueDate: e.dueDate ? toDateInput(e.dueDate) : '',
        unitPublicUuid: e.unitPublicUuid ?? '',
        learningSessionPublicUuid: e.learningSessionPublicUuid ?? '',
        isActive: e.isActive
      });

      // PUBLISHED: solo description y dueDate son editables.
      if (e.status === EvaluationStatus.PUBLISHED) {
        this.lockExceptDescriptionAndDueDate();
      } else if (e.status === EvaluationStatus.CLOSED) {
        this.form.disable();
      }
    } else {
      // Track changes de kind para limitar las scales válidas.
      this.form.get('kind')?.valueChanges.subscribe((kind: EvaluationKind) => {
        const allowed = ALLOWED_SCALES_BY_KIND[kind] ?? [];
        this.allowedScales.set(allowed);
        const current = this.form.get('scale')?.value as EvaluationScale;
        if (!allowed.includes(current)) {
          this.form.get('scale')?.setValue(allowed[0]);
        }
      });
    }
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

  protected kindLabel(k: EvaluationKind): string {
    return EVALUATION_KIND_LABELS[k];
  }

  protected scaleLabel(s: EvaluationScale): string {
    return EVALUATION_SCALE_LABELS[s];
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isReadOnly()) return;

    const v = this.form.getRawValue();
    const e = this.evaluation();

    try {
      if (e) {
        const patch: UpdateEvaluationRequest = {};
        const status = e.status;

        if (status === EvaluationStatus.DRAFT) {
          patch.kind = v.kind;
          patch.scale = v.scale;
          patch.name = (v.name as string).trim();
          patch.weight = parseFloat(String(v.weight));
          patch.scheduledDate = (v.scheduledDate as string) || undefined;
          patch.unitPublicUuid = v.unitPublicUuid ?? '';
          patch.learningSessionPublicUuid = v.learningSessionPublicUuid ?? '';
          patch.isActive = v.isActive as boolean;
        }
        // En PUBLISHED y DRAFT estos dos siempre se pueden editar.
        patch.description = ((v.description as string) ?? '').trim();
        patch.dueDate = (v.dueDate as string) || '';

        const updated = await this.store.update(e.publicUuid, patch);
        if (updated) this.saved.emit(updated);
      } else {
        const assignmentUuid = this.assignmentUuid();
        if (!assignmentUuid) return;
        const payload: CreateEvaluationRequest = {
          kind: v.kind,
          scale: v.scale,
          name: (v.name as string).trim(),
          description: ((v.description as string) ?? '').trim() || undefined,
          weight: parseFloat(String(v.weight)),
          scheduledDate: v.scheduledDate as string,
          dueDate: (v.dueDate as string) || undefined
        };
        const created = await this.store.create(assignmentUuid, payload);
        if (created) this.saved.emit(created);
      }
    } catch (err) {
      this.applyServerErrors(err);
    }
  }

  protected cancel(): void {
    this.store.clearError();
    this.closed.emit();
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
    if (ctrl.errors['min']) {
      return `Debe ser ≥ ${ctrl.errors['min'].min}.`;
    }
    if (ctrl.errors['max']) {
      return `Debe ser ≤ ${ctrl.errors['max'].max}.`;
    }
    return 'Valor inválido.';
  }

  protected showFormError(): string | null {
    const errs = this.form.errors;
    if (!errs) return null;
    if (errs['dateInverted']) {
      return 'La fecha de entrega debe ser ≥ la fecha programada.';
    }
    return null;
  }

  /**
   * En PUBLISHED solo `description` y `dueDate` son editables. Los
   * demás controles se deshabilitan para que la UI sea honesta sobre
   * la matriz del backend (BE-5B.1).
   */
  private lockExceptDescriptionAndDueDate(): void {
    const lockable = [
      'kind',
      'scale',
      'name',
      'weight',
      'scheduledDate',
      'unitPublicUuid',
      'learningSessionPublicUuid',
      'isActive'
    ];
    for (const ctrl of lockable) {
      this.form.get(ctrl)?.disable();
    }
  }

  /**
   * Mapea códigos de error del backend a mensajes de campo. Cobertura
   * actual: {@code EVAL_NAME_EXISTS}, {@code EVAL_KIND_SCALE_MISMATCH},
   * {@code EVAL_DATE_INVERTED}, {@code EVAL_UNIT_NOT_IN_COURSE},
   * {@code EVAL_SESSION_NOT_IN_ASSIGNMENT}.
   */
  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)
      ?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    switch (apiErr.code) {
      case 'EVAL_NAME_EXISTS':
        next['name'] = 'Ya existe una evaluación con este nombre.';
        break;
      case 'EVAL_KIND_SCALE_MISMATCH':
        next['scale'] = 'La escala no es válida para este tipo.';
        break;
      case 'EVAL_DATE_INVERTED':
        next['dueDate'] = 'La fecha de entrega debe ser ≥ la fecha programada.';
        break;
      case 'EVAL_UNIT_NOT_IN_COURSE':
        next['unitPublicUuid'] =
          'La unidad debe pertenecer al mismo curso que la asignación.';
        break;
      case 'EVAL_SESSION_NOT_IN_ASSIGNMENT':
        next['learningSessionPublicUuid'] =
          'La sesión debe pertenecer a esta asignación.';
        break;
    }
    this.fieldErrors.set(next);
  }
}

/** Validator de FormGroup que rechaza {@code dueDate < scheduledDate}. */
function dateRangeValidator(group: FormGroup) {
  const start = group.get('scheduledDate')?.value as string;
  const end = group.get('dueDate')?.value as string;
  if (!start || !end) return null;
  return end < start ? { dateInverted: true } : null;
}

/** Convierte un {@link Date} a {@code yyyy-MM-dd} en zona local. */
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
