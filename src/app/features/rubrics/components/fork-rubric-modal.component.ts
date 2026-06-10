import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { RubricsStore } from '../store';
import { RUBRIC_NAME_MAX_LENGTH, RubricRow } from '../models';

/**
 * Modal de "fork" de una rúbrica existente. El servidor maneja el
 * default del nombre (sufijo "(fork)" si el caller no lo override),
 * pero ofrecemos al usuario la oportunidad de elegir el nombre del
 * clon antes de redirigirlo al editor.
 *
 * <p>Para forks de system rubrics esto es la entrada estándar al
 * editor: el origen es read-only, así que el usuario forkea, le pone
 * nombre, y luego edita criterios/niveles a gusto.</p>
 */
@Component({
  selector: 'app-fork-rubric-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fork-rubric-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-md shadow-xl" (click)="$event.stopPropagation()">
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="fork-rubric-title" class="card-title">Forkear rúbrica</h2>
            <p class="card-description">
              Crea un clon editable de
              <strong>{{ origin().name }}</strong>. Después podrás
              modificar criterios, niveles y descriptores.
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
          @if (errorBanner()) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <p class="flex-1 text-sm">{{ errorBanner() }}</p>
            </div>
          }

          <div class="field">
            <label class="label" for="fork-name">Nombre del clon *</label>
            <input
              id="fork-name"
              type="text"
              class="input"
              formControlName="name"
              [maxlength]="nameMaxLength"
              [placeholder]="defaultName()"
              autocomplete="off"
              autofocus
            />
            @if (showError('name'); as msg) {
              <p class="field-error">{{ msg }}</p>
            } @else {
              <p class="field-hint">
                Único dentro del tenant (case-insensitive).
              </p>
            }
          </div>

          <footer class="flex items-center justify-end gap-2 pt-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">
              Cancelar
            </button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="form.invalid || saving()"
            >
              @if (saving()) {
                <app-spinner [size]="14" label="Forkando" />
                <span>Forkando…</span>
              } @else {
                <app-icon name="layers" [size]="16" />
                <span>Forkear</span>
              }
            </button>
          </footer>
        </form>
      </div>
    </div>
  `
})
export class ForkRubricModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(RubricsStore);

  readonly origin = input.required<RubricRow>();

  readonly closed = output<void>();
  readonly forked = output<string>();

  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;

  protected readonly nameMaxLength = RUBRIC_NAME_MAX_LENGTH;

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.maxLength(RUBRIC_NAME_MAX_LENGTH)]]
  });

  protected defaultName(): string {
    return `${this.origin().name} (fork)`;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancel();
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const name = ((this.form.get('name')?.value as string) ?? '').trim();
    const result = await this.store.fork(
      this.origin().publicUuid,
      name ? { name } : undefined
    );
    if (result) this.forked.emit(result.publicUuid);
  }

  protected cancel(): void {
    this.store.clearError();
    this.closed.emit();
  }

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl) return null;
    if (!ctrl.touched && !ctrl.dirty) return null;
    if (!ctrl.errors) return null;
    if (ctrl.errors['maxlength']) {
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    return 'Valor inválido.';
  }
}
