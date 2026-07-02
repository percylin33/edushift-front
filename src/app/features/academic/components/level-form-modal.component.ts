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
import { AcademicStore } from '../store';
import { AcademicLevel } from '../models';

/**
 * Modal de creación/edición de {@link AcademicLevel}.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Si {@link #level} es {@code null} ⇒ modo create (POST).</li>
 *   <li>Si trae un level ⇒ modo edit (PUT partial-merge).</li>
 *   <li>El modal cierra con {@link #closed} en cancelación o
 *       {@link #saved} con el level resultante en éxito; el caller
 *       decide qué hacer con el evento (típicamente cerrar el modal y
 *       seleccionar el level recién creado).</li>
 * </ul>
 *
 * <h3>Validación</h3>
 * Espejea las constraints del backend (`CreateAcademicLevelRequest`):
 * <ul>
 *   <li>{@code code}: 1..40, regex {@code ^[A-Za-z][A-Za-z0-9_]*$}.</li>
 *   <li>{@code name}: 1..100.</li>
 *   <li>{@code ordinal}: entero ≥ 1.</li>
 * </ul>
 *
 * <p>Mismo trade-off de chrome inline que el resto de modales del
 * proyecto (no usamos un wrapper común aún — DEBT-UX-2).</p>
 */
@Component({
  selector: 'app-level-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-form-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-lg shadow-xl" (click)="$event.stopPropagation()">
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="level-form-title" class="card-title">{{ title() }}</h2>
            <p class="card-description">
              Define un nivel educativo del workspace (ej. INICIAL, PRIMARIA, IGCSE).
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
            <label class="label" for="level-code">Código *</label>
            <input
              id="level-code"
              type="text"
              class="input uppercase"
              formControlName="code"
              autocomplete="off"
              maxlength="40"
              placeholder="PRIMARIA"
            />
            @if (showError('code'); as msg) {
              <p class="field-error">{{ msg }}</p>
            } @else {
              <p class="field-hint">
                Solo letras, dígitos y guion bajo. Empieza con letra. El backend lo normaliza a
                mayúsculas.
              </p>
            }
          </div>

          <div class="field">
            <label class="label" for="level-name">Nombre *</label>
            <input
              id="level-name"
              type="text"
              class="input"
              formControlName="name"
              maxlength="100"
              placeholder="Educación primaria"
            />
            @if (showError('name'); as msg) {
              <p class="field-error">{{ msg }}</p>
            }
          </div>

          <div class="field">
            <label class="label" for="level-ordinal">Orden *</label>
            <input
              id="level-ordinal"
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
                Entero ≥ 1. Define el orden visual del nivel (1 = INICIAL, 2 = PRIMARIA…).
              </p>
            }
          </div>

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
export class LevelFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AcademicStore);

  readonly level = input<AcademicLevel | null>(null);
  readonly closed = output<void>();
  readonly saved = output<AcademicLevel>();

  protected readonly saving = this.store.savingLevel;
  protected readonly errorBanner = this.store.error;

  protected readonly editing = computed(() => this.level() !== null);
  protected readonly title = computed(() => (this.editing() ? 'Editar nivel' : 'Nuevo nivel'));
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Crear nivel',
  );

  private readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form: FormGroup = this.fb.group({
    code: [
      '',
      [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(40),
        Validators.pattern(/^[A-Za-z][A-Za-z0-9_]*$/),
      ],
    ],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    ordinal: [1, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.store.clearError();
    const lvl = this.level();
    if (lvl) {
      this.form.patchValue({
        code: lvl.code,
        name: lvl.name,
        ordinal: lvl.ordinal,
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
    const lvl = this.level();

    try {
      if (lvl) {
        const updated = await this.store.updateLevel(lvl.publicUuid, {
          code: v.code?.trim(),
          name: v.name?.trim(),
          ordinal: v.ordinal,
        });
        if (updated) {
          this.saved.emit(updated);
        }
      } else {
        const created = await this.store.createLevel({
          code: (v.code ?? '').trim(),
          name: (v.name ?? '').trim(),
          ordinal: v.ordinal as number,
        });
        if (created) {
          this.saved.emit(created);
        }
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
    if (ctrl.errors['min']) return 'Debe ser ≥ 1.';
    if (ctrl.errors['pattern']) {
      return 'Solo letras, dígitos y guion bajo. Debe empezar con letra.';
    }
    return 'Valor inválido.';
  }

  private applyServerErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) return;
    const apiErr = (err.error as { errors?: ApiError[] } | null | undefined)?.errors?.[0];
    if (!apiErr) return;

    const next: Record<string, string> = {};
    if (apiErr.code === 'LEVEL_CODE_TAKEN') {
      next['code'] = 'Ya existe un nivel con este código.';
    }
    this.fieldErrors.set(next);
  }
}
