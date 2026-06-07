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
import { AcademicStore } from '../store';
import { Grade } from '../models';

/**
 * Modal de creación/edición de {@link Grade} dentro de un level.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Si {@link #grade} es {@code null} ⇒ modo create. Requiere
 *       {@link #levelUuid} para resolver el endpoint.</li>
 *   <li>Si trae un grade ⇒ modo edit. Se ignora {@link #levelUuid}
 *       (se toma del grade).</li>
 * </ul>
 *
 * <h3>Validación</h3>
 * Espejea {@code CreateGradeRequest} / {@code UpdateGradeRequest}:
 * <ul>
 *   <li>{@code name}: 1..100, requerido.</li>
 *   <li>{@code ordinal}: entero ≥ 1, requerido.</li>
 * </ul>
 *
 * <p>Para mover un grade entre levels el backend exige re-crear (no
 * hay campo {@code levelUuid} en el PUT) — la UI por ahora no expone
 * ese flujo.</p>
 */
@Component({
  selector: 'app-grade-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grade-form-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-md shadow-xl" (click)="$event.stopPropagation()">
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="grade-form-title" class="card-title">{{ title() }}</h2>
            <p class="card-description">
              Grado dentro del nivel actual (ej. "1ro", "2do").
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

          <div class="field">
            <label class="label" for="grade-name">Nombre *</label>
            <input
              id="grade-name"
              type="text"
              class="input"
              formControlName="name"
              maxlength="100"
              placeholder="1ro de primaria"
            />
            @if (showError('name'); as msg) {
              <p class="field-error">{{ msg }}</p>
            }
          </div>

          <div class="field">
            <label class="label" for="grade-ordinal">Orden *</label>
            <input
              id="grade-ordinal"
              type="number"
              class="input"
              formControlName="ordinal"
              min="1"
              step="1"
            />
            @if (showError('ordinal'); as msg) {
              <p class="field-error">{{ msg }}</p>
            } @else {
              <p class="field-hint">
                Entero ≥ 1, único dentro del nivel. Puedes ajustarlo después arrastrando filas.
              </p>
            }
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
export class GradeFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AcademicStore);

  /** {@code null} ⇒ create. Si se provee, se ignora {@link #levelUuid}. */
  readonly grade = input<Grade | null>(null);
  /** Requerido en modo create. */
  readonly levelUuid = input<string | null>(null);
  /** Sugerencia de ordinal (último + 1) para evitar colisiones al crear. */
  readonly suggestedOrdinal = input<number>(1);

  readonly closed = output<void>();
  readonly saved = output<Grade>();

  protected readonly saving = this.store.savingGrade;
  protected readonly errorBanner = this.store.error;

  protected readonly editing = computed(() => this.grade() !== null);
  protected readonly title = computed(() =>
    this.editing() ? 'Editar grado' : 'Nuevo grado'
  );
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear grado'
  );

  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    ordinal: [1, [Validators.required, Validators.min(1)]]
  });

  ngOnInit(): void {
    this.store.clearError();
    const g = this.grade();
    if (g) {
      this.form.patchValue({ name: g.name, ordinal: g.ordinal });
    } else {
      this.form.patchValue({ ordinal: this.suggestedOrdinal() });
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
    const g = this.grade();

    try {
      if (g) {
        const updated = await this.store.updateGrade(g.levelPublicUuid, g.publicUuid, {
          name: v.name?.trim(),
          ordinal: v.ordinal
        });
        if (updated) {
          this.saved.emit(updated);
        }
      } else {
        const lvl = this.levelUuid();
        if (!lvl) return;
        const created = await this.store.createGrade(lvl, {
          name: (v.name ?? '').trim(),
          ordinal: v.ordinal as number
        });
        if (created) {
          this.saved.emit(created);
        }
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

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    if (apiErr.code === 'GRADE_ORDINAL_TAKEN') {
      next['ordinal'] = 'Ya hay un grado con este orden en el nivel.';
    }
    this.fieldErrors.set(next);
  }
}
