import { createFormProtection } from '@shared/services/form-protection.service';
import { SafeBackdropDirective } from '@shared/directives/safe-backdrop.directive';
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
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FocusTrap } from '@shared/a11y';
import { FilePreviewDialogComponent, IconComponent } from '@shared/components';
import { SubmissionRow } from '../../models';
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
  imports: [SafeBackdropDirective, CommonModule, ReactiveFormsModule, IconComponent, FilePreviewDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="dialogTitleId"
        appSafeBackdrop (click)="onBackdrop($event)"
      >
        <div
          #dialog
          class="card max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto"
          (click)="$event.stopPropagation()"
        >
          <header class="border-b border-surface-muted px-5 py-5 sm:px-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  {{ mode === 'Grade' ? 'Revisión de entrega' : 'Solicitud de corrección' }}
                </p>
                <h2 [id]="dialogTitleId" class="text-xl font-semibold text-content">
                  @if (mode === 'Grade') {
                    Calificar entrega
                  } @else {
                    Devolver para re-entrega
                  }
                </h2>
                <p class="mt-1 text-sm text-content-muted">
                  @if (mode === 'Grade') {
                    Revisa el trabajo y registra una nota con comentarios para el alumno.
                  } @else {
                  Explica qué debe corregir. El alumno podrá enviar una nueva versión.
                  }
                </p>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm -mr-2 -mt-1"
                aria-label="Cerrar diálogo"
                (click)="onCancel()"
                [disabled]="saving"
              >
                <app-icon name="x" [size]="18" />
              </button>
            </div>
          </header>

          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            class="grid gap-5 px-5 py-5 sm:px-6"
          >
            @if (submission) {
              <section
                class="flex items-center gap-3 rounded-xl bg-surface-muted/60 p-3"
                aria-label="Entrega seleccionada"
              >
                <div
                  class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-sm font-semibold text-content-muted"
                >
                  @if (submission.studentAvatarUrl) {
                    <img
                      [src]="submission.studentAvatarUrl"
                      [alt]="submission.studentFullName"
                      class="h-full w-full object-cover"
                    />
                  } @else {
                    {{ initials(submission.studentFullName) }}
                  }
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold text-content">{{ submission.studentFullName }}</p>
                  <p class="text-xs text-content-muted">
                    Entregada {{ submission.submittedAt | date: 'd MMM y, HH:mm' }}
                    <span aria-hidden="true">·</span> Versión {{ submission.version }}
                  </p>
                </div>
                @if (submission.hasAttachment && submission.attachmentPublicUuid) {
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm shrink-0"
                    [attr.aria-label]="'Abrir adjunto ' + (submission.attachmentFilename || 'de la entrega')"
                    (click)="onPreviewSubmission()"
                  >
                    <app-icon name="paperclip" [size]="14" />
                    <span class="hidden sm:inline">Ver entrega</span>
                    <span class="sm:hidden">Abrir</span>
                  </button>
                }
              </section>
            }

            @if (mode === 'Grade') {
              <section class="rounded-xl border border-surface-muted p-4 sm:p-5">
                <div class="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <label class="label" for="grade-input">Calificación</label>
                    <p class="mt-1 text-xs text-content-muted">Define el puntaje obtenido</p>
                  </div>
                  <div class="flex items-baseline gap-1 rounded-lg bg-primary/10 px-3 py-2 text-primary">
                    <span class="text-2xl font-bold tabular-nums">{{ currentGrade() }}</span>
                    <span class="text-sm font-medium">/ {{ maxScore }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <input
                    id="grade-input"
                    type="range"
                    class="range min-w-0 flex-1"
                    min="0"
                    [max]="maxScore"
                    step="0.1"
                    formControlName="grade"
                    [attr.aria-label]="'Calificación de 0 a ' + maxScore"
                  />
                  <input
                    id="grade-number"
                    type="number"
                    class="input w-24 text-center text-lg font-semibold tabular-nums"
                    min="0"
                    [max]="maxScore"
                    step="0.1"
                    formControlName="grade"
                    [attr.aria-label]="'Puntaje sobre ' + maxScore"
                  />
                </div>
                @if (showError('grade'); as msg) {
                  <p class="field-error">{{ msg }}</p>
                } @else {
                  <p class="mt-2 text-xs text-content-muted">
                    Puedes usar decimales. Máximo {{ maxScore }} puntos.
                  </p>
                }
              </section>
            }

            <div class="field">
              <div class="mb-1 flex items-center justify-between gap-2">
                <label class="label" for="grade-feedback">
                  Comentarios {{ mode === 'Return' ? '*' : '(opcional)' }}
                </label>
                <span class="text-xs text-content-muted">{{ feedbackLength() }}/2000</span>
              </div>
              <textarea
                id="grade-feedback"
                class="input min-h-[120px] resize-y"
                rows="5"
                formControlName="feedback"
                [placeholder]="
                  mode === 'Return'
                    ? 'Describe los cambios concretos que debe realizar…'
                    : 'Destaca los aciertos y sugiere cómo puede mejorar…'
                "
                [attr.maxlength]="2000"
              ></textarea>
              @if (showError('feedback'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>

            <footer
              class="-mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-surface-muted bg-surface-muted/30 px-5 py-4 sm:-mx-6 sm:-mb-5 sm:flex-row sm:justify-end sm:px-6"
            >
              <button
                type="button"
                class="btn btn-ghost"
                (click)="onCancel()"
                [disabled]="saving"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="btn"
                [class.btn-primary]="mode === 'Grade'"
                [class.btn-danger]="mode === 'Return'"
                [disabled]="form.invalid || saving"
              >
                <app-icon [name]="mode === 'Grade' ? 'check' : 'rotate-ccw'" [size]="16" />
                <span>
                  @if (mode === 'Grade') {
                    {{ saving ? 'Guardando…' : 'Guardar calificación' }}
                  } @else {
                    {{ saving ? 'Enviando…' : 'Devolver al alumno' }}
                  }
                </span>
              </button>
            </footer>
          </form>
        </div>
        @if (previewAttachment(); as attachment) {
          <app-file-preview-dialog
            [open]="true"
            [filePublicUuid]="attachment.publicUuid"
            [filename]="attachment.filename"
            (closed)="previewAttachment.set(null)"
          />
        }
      </div>
    }
  `,
})
export class GradeDialogComponent implements OnChanges, OnInit, OnDestroy {
  protected readonly formProtection = createFormProtection({
    snapshot: () => this.form.getRawValue(),
    saving: () => this.saving,
    active: () => this.open,
  });

  @Input() open = false;
  @Input() mode: GradeMode = 'Grade';
  @Input() maxScore = 20;
  @Input() saving = false;
  @Input() submission: SubmissionRow | null = null;

  @Output() readonly grade = new EventEmitter<GradeSubmissionRequest>();
  @Output() readonly cancelled = new EventEmitter<void>();
  @Output() readonly return = new EventEmitter<{ feedback: string }>();

  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly focusTrap = inject(FocusTrap);
  protected readonly dialogTitleId = `grade-dialog-title-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly previewAttachment = signal<{
    publicUuid: string;
    filename: string;
  } | null>(null);

  protected readonly form: FormGroup = this.fb.group({
    grade: [0, [Validators.required, Validators.min(0), Validators.max(1000)]],
    feedback: ['', [Validators.maxLength(2000)]],
  });

  protected currentGrade(): number {
    const value = Number(this.form.get('grade')?.value ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  protected feedbackLength(): number {
    return (this.form.get('feedback')?.value ?? '').toString().length;
  }

  protected initials(fullName: string): string {
    return fullName
      .split(/\s+/)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('');
  }

  protected onPreviewSubmission(): void {
    const submission = this.submission;
    if (!submission?.attachmentPublicUuid) return;
    this.previewAttachment.set({
      publicUuid: submission.attachmentPublicUuid,
      filename: submission.attachmentFilename || 'entrega',
    });
  }

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
          this.form
            .get('grade')!
            .setValidators([Validators.required, Validators.min(0), Validators.max(this.maxScore)]);
          this.form.get('grade')!.updateValueAndValidity();
        } else {
          this.form
            .get('feedback')!
            .setValidators([Validators.required, Validators.maxLength(2000)]);
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
    this.formProtection.requestClose(() => {
      this.previewAttachment.set(null);
      this.cancelled.emit();
    });
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
        feedback: (v.feedback ?? '').toString().trim() || null,
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
