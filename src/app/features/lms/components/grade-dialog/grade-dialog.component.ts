import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { FocusTrap } from '@shared/a11y';
import { IconComponent } from '@shared/components';
import { GradeMode, GradeSubmissionRequest } from './grade-dialog.types';

/**
 * Modal de calificación / devolución (FE-7a.2 Scenario 4 y 5).
 *
 * <h3>Modos</h3>
 * <ul>
 *   <li>{@code Grade} — slider + input numérico (0..maxScore) +
 *       textarea de feedback. Botón "Calificar" emite
 *       {@code grade({ grade, feedback })}.</li>
 *   <li>{@code Return} — textarea de feedback (sin grade). Botón
 *       "Devolver para re-entrega" emite
 *       {@code grade({ mode: 'RETURN', feedback })}.</li>
 * </ul>
 *
 * <h3>A11y</h3>
 * Focus trap en el dialog; cierre con {@code Esc}; click sobre el
 * backdrop NO cierra (decisión explícita — destructivo, requiere
 * acción consciente). Botones con etiquetas descriptivas.
 */
@Component({
  selector: 'app-grade-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="dialogTitleId"
        (click)="onBackdrop($event)"
      >
        <div
          #dialog
          class="card w-full max-w-md"
          (click)="$event.stopPropagation()"
        >
          <header class="card-header">
            <h2 [id]="dialogTitleId" class="card-title">
              @if (mode === 'Grade') { Calificar entrega }
              @else { Devolver para re-entrega }
            </h2>
            <p class="card-description">
              @if (mode === 'Grade') {
                Ingresa la nota (0..{{ maxScore }}) y, opcionalmente,
                feedback para el alumno.
              } @else {
                Indica al alumno qué debe corregir. La entrega vuelve
                a estado pendiente y podrá re-enviar.
              }
            </p>
          </header>

          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            class="card-body grid gap-4"
          >
            @if (mode === 'Grade') {
              <div class="field">
                <label class="label" for="grade-input">Calificación</label>
                <div class="flex items-center gap-3">
                  <input
                    id="grade-input"
                    type="range"
                    class="range flex-1"
                    min="0"
                    [max]="maxScore"
                    step="0.1"
                    formControlName="grade"
                  />
                  <input
                    type="number"
                    class="input w-20"
                    min="0"
                    [max]="maxScore"
                    step="0.1"
                    formControlName="grade"
                  />
                </div>
                @if (showError('grade'); as msg) {
                  <p class="field-error">{{ msg }}</p>
                } @else {
                  <p class="field-hint">
                    Decimal entre 0 y {{ maxScore }}.
                  </p>
                }
              </div>
            }

            <div class="field">
              <label class="label" for="grade-feedback">
                Feedback {{ mode === 'Return' ? '*' : '(opcional)' }}
              </label>
              <textarea
                id="grade-feedback"
                class="input min-h-[100px]"
                rows="4"
                formControlName="feedback"
                [placeholder]="mode === 'Return' ? '¿Qué debe corregir el alumno?' : 'Comentarios para el alumno…'"
              ></textarea>
              @if (showError('feedback'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <footer class="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                (click)="onCancel()"
                [disabled]="saving"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="btn btn-sm"
                [class.btn-primary]="mode === 'Grade'"
                [class.btn-danger]="mode === 'Return'"
                [disabled]="form.invalid || saving"
              >
                <app-icon
                  [name]="mode === 'Grade' ? 'check' : 'rotate-ccw'"
                  [size]="16"
                />
                <span>
                  @if (mode === 'Grade') { Calificar }
                  @else { Devolver }
                </span>
              </button>
            </footer>
          </form>
        </div>
      </div>
    }
  `
})
export class GradeDialogComponent implements OnChanges, OnInit, OnDestroy {
  @Input() open = false;
  @Input() mode: GradeMode = 'Grade';
  @Input() maxScore = 20;
  @Input() saving = false;

  @Output() readonly grade = new EventEmitter<GradeSubmissionRequest>();
  @Output() readonly cancelled = new EventEmitter<void>();
  @Output() readonly return = new EventEmitter<{ feedback: string }>();

  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly focusTrap = inject(FocusTrap);
  protected readonly dialogTitleId = `grade-dialog-title-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly form: FormGroup = this.fb.group({
    grade: [0, [Validators.required, Validators.min(0), Validators.max(1000)]],
    feedback: ['', [Validators.maxLength(2000)]]
  });

  private previouslyFocused: HTMLElement | null = null;
  private readonly escapeHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.open) this.onCancel();
  };

  ngOnInit(): void {
    document.addEventListener('keydown', this.escapeHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.escapeHandler);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        queueMicrotask(() => {
          const root = this.dialogRef?.nativeElement;
          if (root) this.focusTrap.activate(root);
        });
        this.form.reset({ grade: 0, feedback: '' });
        if (this.mode === 'Grade') {
          this.form.get('grade')!.setValidators([
            Validators.required,
            Validators.min(0),
            Validators.max(this.maxScore)
          ]);
          this.form.get('grade')!.updateValueAndValidity();
        } else {
          this.form.get('feedback')!.setValidators([
            Validators.required,
            Validators.maxLength(2000)
          ]);
          this.form.get('feedback')!.updateValueAndValidity();
        }
      } else if (this.previouslyFocused) {
        this.focusTrap.deactivate();
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    }
  }

  protected onBackdrop(event: MouseEvent): void {
    // Cierre por backdrop deshabilitado (acción destructiva).
    event.preventDefault();
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (this.mode === 'Grade') {
      this.grade.emit({
        grade: Number(v.grade),
        feedback: (v.feedback ?? '').toString().trim() || null
      });
    } else {
      this.return.emit({ feedback: (v.feedback ?? '').toString().trim() });
    }
  }

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl || (!ctrl.touched && !ctrl.dirty)) return null;
    if (ctrl.errors?.['required']) return 'Campo requerido.';
    if (ctrl.errors?.['maxlength']) {
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors?.['min']) return `Debe ser ≥ ${ctrl.errors['min'].min}.`;
    if (ctrl.errors?.['max']) return `Debe ser ≤ ${ctrl.errors['max'].max}.`;
    return null;
  }
}
