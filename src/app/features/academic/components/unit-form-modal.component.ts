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
import { IconComponent, SpinnerComponent } from '@shared/components';
import { UnitsStore } from '../store';
import { UNIT_DESCRIPTION_MAX_LENGTH, UNIT_NAME_MAX_LENGTH, UnitDetail } from '../models';

/**
 * Modal de creación/edición de {@link UnitDetail} dentro de un curso.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Si {@link #unit} es {@code null} ⇒ modo create. Requiere
 *       {@link #courseUuid} para resolver el endpoint.</li>
 *   <li>Si trae una unidad ⇒ modo edit. {@link #courseUuid} se ignora
 *       (la unidad ya está vinculada).</li>
 * </ul>
 *
 * <h3>Validación cliente (espejo del BE)</h3>
 * <ul>
 *   <li>{@code name}: requerido, 1..200.</li>
 *   <li>{@code description}: opcional, max 4000.</li>
 *   <li>{@code startDate} / {@code endDate}: opcionales; si ambas
 *       están presentes, {@code endDate >= startDate}. La validación
 *       cruzada se ejecuta como validador de FormGroup para mostrar el
 *       error sin tener que esperar el round-trip.</li>
 *   <li>{@code isActive}: toggle, default {@code true} en create.</li>
 * </ul>
 *
 * <p>El {@code displayOrder} no se expone en el form: en create, el
 * BE lo appendea al tail; en edit, el reorder se hace por
 * drag-and-drop, no por edición de número.</p>
 */
@Component({
  selector: 'app-unit-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unit-form-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-lg shadow-xl" (click)="$event.stopPropagation()">
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="unit-form-title" class="card-title">{{ title() }}</h2>
            <p class="card-description">
              Unidad de aprendizaje del curso. Las fechas son guías pedagógicas; las sesiones
              validan su propio rango contra el periodo del assignment.
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

          <div class="field">
            <label class="label" for="unit-name">Nombre *</label>
            <input
              id="unit-name"
              type="text"
              class="input"
              formControlName="name"
              [maxlength]="nameMaxLength"
              placeholder="Unidad I — Números naturales"
              autocomplete="off"
            />
            @if (showError('name'); as msg) {
              <p class="field-error">{{ msg }}</p>
            } @else {
              <p class="field-hint">Único dentro del curso (case-insensitive).</p>
            }
          </div>

          <div class="field">
            <label class="label" for="unit-description">Descripción</label>
            <textarea
              id="unit-description"
              class="input"
              formControlName="description"
              rows="3"
              [maxlength]="descriptionMaxLength"
              placeholder="Resumen pedagógico u observaciones internas."
            ></textarea>
            @if (showError('description'); as msg) {
              <p class="field-error">{{ msg }}</p>
            }
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="field">
              <label class="label" for="unit-start">Fecha inicio</label>
              <input id="unit-start" type="date" class="input" formControlName="startDate" />
              @if (showError('startDate'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <div class="field">
              <label class="label" for="unit-end">Fecha fin</label>
              <input id="unit-end" type="date" class="input" formControlName="endDate" />
              @if (showError('endDate'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>
          </div>

          @if (showFormError(); as msg) {
            <p class="field-error -mt-2">{{ msg }}</p>
          }

          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" formControlName="isActive" />
            <span>Unidad activa</span>
            <span class="text-xs text-content-muted">
              (las inactivas no aparecen al crear sesiones)
            </span>
          </label>

          <footer class="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">Cancelar</button>
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
  `,
})
export class UnitFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(UnitsStore);

  /** {@code null} ⇒ create. */
  readonly unit = input<UnitDetail | null>(null);
  /** Requerido en modo create. */
  readonly courseUuid = input<string | null>(null);

  readonly closed = output<void>();
  readonly saved = output<UnitDetail>();

  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;

  protected readonly editing = computed(() => this.unit() !== null);
  protected readonly title = computed(() => (this.editing() ? 'Editar unidad' : 'Nueva unidad'));
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear unidad',
  );

  protected readonly nameMaxLength = UNIT_NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = UNIT_DESCRIPTION_MAX_LENGTH;

  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form: FormGroup = this.fb.group(
    {
      name: ['', [Validators.required, Validators.maxLength(UNIT_NAME_MAX_LENGTH)]],
      description: ['', [Validators.maxLength(UNIT_DESCRIPTION_MAX_LENGTH)]],
      startDate: [''],
      endDate: [''],
      isActive: [true],
    },
    { validators: [dateRangeValidator] },
  );

  ngOnInit(): void {
    this.store.clearError();
    const u = this.unit();
    if (u) {
      this.form.patchValue({
        name: u.name,
        description: u.description ?? '',
        startDate: u.startDate ? toDateInput(u.startDate) : '',
        endDate: u.endDate ? toDateInput(u.endDate) : '',
        isActive: u.isActive,
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

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload = {
      name: (v.name as string).trim(),
      description: (v.description as string)?.trim() || undefined,
      startDate: (v.startDate as string) || undefined,
      endDate: (v.endDate as string) || undefined,
      isActive: v.isActive as boolean,
    };

    try {
      const u = this.unit();
      if (u) {
        const updated = await this.store.updateUnit(u.publicUuid, {
          name: payload.name,
          description: payload.description ?? '',
          startDate: payload.startDate ?? null,
          endDate: payload.endDate ?? null,
          isActive: payload.isActive,
        });
        if (updated) this.saved.emit(updated);
      } else {
        const courseUuid = this.courseUuid();
        if (!courseUuid) return;
        const created = await this.store.createUnit(courseUuid, payload);
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
    return 'Valor inválido.';
  }

  protected showFormError(): string | null {
    const errs = this.form.errors;
    if (!errs) return null;
    if (errs['dateInverted']) {
      return 'La fecha de fin debe ser igual o posterior a la de inicio.';
    }
    return null;
  }

  /**
   * Mapea códigos de error del backend a mensajes de campo. Cobertura
   * actual: {@code UNIT_NAME_EXISTS} y {@code UNIT_DATE_INVERTED}; el
   * resto cae al banner global vía {@code store.error}.
   */
  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    if (apiErr.code === 'UNIT_NAME_EXISTS') {
      next['name'] = 'Ya existe una unidad con este nombre en el curso.';
    } else if (apiErr.code === 'UNIT_DATE_INVERTED') {
      next['endDate'] = 'La fecha de fin debe ser ≥ la fecha de inicio.';
    }
    this.fieldErrors.set(next);
  }
}

/**
 * Validator de FormGroup que rechaza {@code endDate < startDate}.
 * Vacíos son válidos (las dos son opcionales).
 */
function dateRangeValidator(group: FormGroup) {
  const start = group.get('startDate')?.value as string;
  const end = group.get('endDate')?.value as string;
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
