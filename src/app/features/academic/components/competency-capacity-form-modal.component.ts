import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { CompetenciesStore } from '../store';
import {
  COMPETENCY_CODE_MAX_LENGTH,
  COMPETENCY_DESCRIPTION_MAX_LENGTH,
  COMPETENCY_NAME_MAX_LENGTH,
  CompetencyDetail,
  CreateCapacityRequest,
  CreateCompetencyRequest,
  UpdateCapacityRequest,
  UpdateCompetencyRequest,
} from '../models';

export type FormMode =
  'competency-create' | 'competency-edit' | 'capacity-create' | 'capacity-edit';

/**
 * Modal reutilizable para crear/editar Competencies y Capacities.
 *
 * <h3>Modos</h3>
 * <ul>
 *   <li>{@code competency-create}: formulario limpio, target = curso.</li>
 *   <li>{@code competency-edit}: hidrata con {@link #competency}.</li>
 *   <li>{@code capacity-create}: formulario limpio, target = competencia.</li>
 *   <li>{@code capacity-edit}: hidrata con {@link #capacity} (que debe
 *       venir dentro de {@link #competency}.capacities).</li>
 * </ul>
 *
 * <h3>Validación</h3>
 * <p>Espejo del backend: {@code code} alfanumérico empezando con letra,
 * {@code name} requerido, {@code description} opcional. El
 * {@code displayOrder} se omite aquí (se maneja con drag-drop en el
 * tab, igual que Units).</p>
 */
@Component({
  selector: 'app-competency-capacity-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-lg shadow-xl" (click)="$event.stopPropagation()">
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="form-title" class="card-title">{{ title() }}</h2>
            <p class="card-description">{{ subtitle() }}</p>
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
            <label class="label" for="code">Código *</label>
            <input
              id="code"
              type="text"
              class="input"
              formControlName="code"
              [maxlength]="COMPETENCY_CODE_MAX_LENGTH"
              placeholder="Ej: C1, MAT01"
              autocomplete="off"
            />
            @if (showError('code'); as msg) {
              <p class="field-error">{{ msg }}</p>
            } @else {
              <p class="field-hint">
                Debe empezar con una letra y contener solo letras, números o guiones bajos.
              </p>
            }
          </div>

          <div class="field">
            <label class="label" for="name">Nombre *</label>
            <input
              id="name"
              type="text"
              class="input"
              formControlName="name"
              [maxlength]="COMPETENCY_NAME_MAX_LENGTH"
              placeholder="Ej: Resuelve problemas de cantidad"
            />
            @if (showError('name'); as msg) {
              <p class="field-error">{{ msg }}</p>
            }
          </div>

          <div class="field">
            <label class="label" for="description">Descripción (opcional)</label>
            <textarea
              id="description"
              class="input"
              formControlName="description"
              rows="3"
              [maxlength]="COMPETENCY_DESCRIPTION_MAX_LENGTH"
              placeholder="Detalle pedagógico adicional..."
            ></textarea>
            @if (showError('description'); as msg) {
              <p class="field-error">{{ msg }}</p>
            }
          </div>

          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" formControlName="isActive" />
            <span>Activo</span>
            <span class="text-xs text-content-muted">
              {{
                isCompetency
                  ? 'Las inactivas no aparecen al crear sesiones.'
                  : 'Las inactivas no aparecen al planificar sesiones.'
              }}
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
  styles: [
    `
      :host {
        display: block;
      }
      .field-error {
        @apply mt-1 text-xs text-red-600;
      }
    `,
  ],
})
export class CompetencyCapacityFormModalComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(CompetenciesStore);

  @Input() mode: FormMode = 'competency-create';
  @Input() courseUuid: string | null = null;
  @Input() competency: CompetencyDetail | null = null;
  @Input() capacityPublicUuid: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly COMPETENCY_CODE_MAX_LENGTH = COMPETENCY_CODE_MAX_LENGTH;
  readonly COMPETENCY_NAME_MAX_LENGTH = COMPETENCY_NAME_MAX_LENGTH;
  readonly COMPETENCY_DESCRIPTION_MAX_LENGTH = COMPETENCY_DESCRIPTION_MAX_LENGTH;

  form!: FormGroup;
  serverErrors: Record<string, string> = {};

  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;

  protected readonly isCompetency =
    this.mode === 'competency-create' || this.mode === 'competency-edit';
  protected readonly isCreate =
    this.mode === 'competency-create' || this.mode === 'capacity-create';

  protected readonly title = computed(() => {
    if (this.mode === 'competency-create') return 'Nueva Competencia';
    if (this.mode === 'competency-edit') return 'Editar Competencia';
    if (this.mode === 'capacity-create') return 'Nueva Capacidad';
    return 'Editar Capacidad';
  });

  protected readonly subtitle = computed(() => {
    if (this.isCompetency) {
      return 'Define el aggregate pedagógico principal del curso.';
    }
    return 'Desglose granular de habilidades evaluables dentro de la competencia.';
  });

  protected readonly submitLabel = computed(() => {
    if (this.mode === 'competency-create') return 'Crear Competencia';
    if (this.mode === 'competency-edit') return 'Guardar Cambios';
    if (this.mode === 'capacity-create') return 'Crear Capacidad';
    return 'Guardar Cambios';
  });

  ngOnInit(): void {
    this.store.clearError();
    this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mode'] || changes['competency'] || changes['capacityPublicUuid']) {
      this.buildForm();
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

  private buildForm(): void {
    this.serverErrors = {};
    const isEdit = !this.isCreate;

    this.form = this.fb.group({
      code: [
        isEdit && this.isCompetency
          ? this.competency?.code
          : isEdit && !this.isCompetency
            ? this.getTargetCapacity()?.code
            : '',
        [
          Validators.required,
          Validators.maxLength(this.COMPETENCY_CODE_MAX_LENGTH),
          Validators.pattern(/^[A-Za-z][A-Za-z0-9_]*$/),
        ],
      ],
      name: [
        isEdit && this.isCompetency
          ? this.competency?.name
          : isEdit && !this.isCompetency
            ? this.getTargetCapacity()?.name
            : '',
        [Validators.required, Validators.maxLength(this.COMPETENCY_NAME_MAX_LENGTH)],
      ],
      description: [
        isEdit && this.isCompetency
          ? this.competency?.description
          : isEdit && !this.isCompetency
            ? this.getTargetCapacity()?.description
            : '',
        [Validators.maxLength(this.COMPETENCY_DESCRIPTION_MAX_LENGTH)],
      ],
      isActive: [
        isEdit && this.isCompetency
          ? this.competency?.isActive
          : isEdit && !this.isCompetency
            ? this.getTargetCapacity()?.isActive
            : true,
      ],
    });
  }

  private getTargetCapacity() {
    if (!this.isCompetency && this.competency && this.capacityPublicUuid) {
      return this.competency.capacities.find((c) => c.publicUuid === this.capacityPublicUuid);
    }
    return null;
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.serverErrors = {};
    const raw = this.form.getRawValue();

    if (this.isCompetency) {
      const req: CreateCompetencyRequest | UpdateCompetencyRequest = this.isCreate
        ? {
            code: raw.code!.trim(),
            name: raw.name!.trim(),
            description: raw.description?.trim() || undefined,
            isActive: raw.isActive,
          }
        : {
            code: raw.code?.trim() || undefined,
            name: raw.name?.trim() || undefined,
            description: raw.description !== undefined ? raw.description.trim() || null : undefined,
            isActive: raw.isActive,
          };

      if (this.isCreate && this.courseUuid) {
        const ok = await this.store.createCompetency(req as CreateCompetencyRequest);
        if (ok) {
          this.saved.emit();
        } else {
          this.applyServerErrors();
        }
      } else if (!this.isCreate && this.competency) {
        const ok = await this.store.updateCompetency(
          this.competency.publicUuid,
          req as UpdateCompetencyRequest,
        );
        if (ok) {
          this.saved.emit();
        } else {
          this.applyServerErrors();
        }
      }
    } else {
      const req: CreateCapacityRequest | UpdateCapacityRequest = this.isCreate
        ? {
            code: raw.code!.trim(),
            name: raw.name!.trim(),
            description: raw.description?.trim() || undefined,
            isActive: raw.isActive,
          }
        : {
            code: raw.code?.trim() || undefined,
            name: raw.name?.trim() || undefined,
            description: raw.description !== undefined ? raw.description.trim() || null : undefined,
            isActive: raw.isActive,
          };

      if (this.isCreate && this.competency) {
        const ok = await this.store.createCapacity(
          this.competency.publicUuid,
          req as CreateCapacityRequest,
        );
        if (ok) {
          this.saved.emit();
        } else {
          this.applyServerErrors();
        }
      } else if (!this.isCreate && this.capacityPublicUuid) {
        const ok = await this.store.updateCapacity(
          this.capacityPublicUuid,
          req as UpdateCapacityRequest,
        );
        if (ok) {
          this.saved.emit();
        } else {
          this.applyServerErrors();
        }
      }
    }
  }

  private applyServerErrors(): void {
    const err = this.store.error();
    if (!err) return;

    if (err.includes('COMPETENCY_CODE_TAKEN') || err.includes('CAPACITY_CODE_TAKEN')) {
      this.serverErrors['code'] = 'Este código ya está en uso.';
      this.form.get('code')?.setErrors({ server: true });
    } else if (err.includes('COMPETENCY_ORDER_TAKEN') || err.includes('CAPACITY_ORDER_TAKEN')) {
      console.warn('Orden tomado (concurrente):', err);
    }
  }

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl) return null;

    const serverErr = this.serverErrors[controlName];
    if (serverErr) return serverErr;

    if (!ctrl.touched && !ctrl.dirty) return null;
    if (!ctrl.errors) return null;
    if (ctrl.errors['required']) return 'Campo requerido.';
    if (ctrl.errors['maxlength']) {
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors['pattern']) {
      return 'Debe empezar con una letra y contener solo letras, números o guiones bajos.';
    }
    return 'Valor inválido.';
  }

  protected cancel(): void {
    this.store.clearError();
    this.closed.emit();
  }
}
