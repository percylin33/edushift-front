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
import { IconComponent, SpinnerComponent } from '@shared/components';
import { EvaluationScale } from '@features/evaluations/models';
import {
  ALLOWED_LITERALS_BY_SCALE,
  COMMENTS_MAX_LENGTH,
  CreateGradeRecordRequest,
  GradeRecordRow,
  SCORE_MAX,
  SCORE_MIN,
  validateGradeShape,
} from '../models';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Modal de registro / edición individual de un GradeRecord (FE-5B.3).
 *
 * <h3>Modos</h3>
 * <ul>
 *   <li>{@link #row} {@code null} ⇒ create / upsert por UUID de estudiante.</li>
 *   <li>{@link #row} presente ⇒ edit del existente; el campo de UUID
 *       queda read-only (el (eval, student) tuple es inmutable —
 *       BE-5B.3).</li>
 * </ul>
 *
 * <p>El campo "valor" se renderiza como input numérico para
 * {@link EvaluationScale#SCORE_0_20} y como {@code <select>} con los
 * literales permitidos para las scales literales.</p>
 */
@Component({
  selector: 'app-grade-record-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grade-form-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-md shadow-xl" (click)="$event.stopPropagation()">
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="grade-form-title" class="card-title">{{ title() }}</h2>
            <p class="card-description">{{ description() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Cerrar" (click)="cancel()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card-body grid gap-4">
          @if (errorBanner()) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="16" />
              <p class="flex-1 text-sm">{{ errorBanner() }}</p>
            </div>
          }

          <div class="field">
            <label class="label" for="grade-uuid">Estudiante (UUID) *</label>
            <input
              id="grade-uuid"
              type="text"
              class="input font-mono text-xs"
              formControlName="studentPublicUuid"
              [readonly]="editing()"
              placeholder="ej: a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa"
              autocomplete="off"
            />
            @if (showError('studentPublicUuid'); as msg) {
              <p class="field-error">{{ msg }}</p>
            } @else if (!editing()) {
              <p class="field-hint">
                Pega el publicUuid del estudiante. (Roster por sección llegará en sprint posterior.)
              </p>
            }
          </div>

          @if (scale() === scaleScore) {
            <div class="field">
              <label class="label" for="grade-score">Nota *</label>
              <input
                id="grade-score"
                type="number"
                step="0.01"
                [min]="scoreMin"
                [max]="scoreMax"
                class="input"
                formControlName="score"
                placeholder="ej: 17.50"
              />
              @if (showError('score'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">Vigesimal {{ scoreMin }} a {{ scoreMax }} (2 decimales).</p>
              }
            </div>
          } @else {
            <div class="field">
              <label class="label" for="grade-literal">Literal *</label>
              <select id="grade-literal" class="input" formControlName="literal">
                <option value="">— Selecciona —</option>
                @for (l of allowedLiterals(); track l) {
                  <option [value]="l">{{ l }}</option>
                }
              </select>
              @if (showError('literal'); as msg) {
                <p class="field-error">{{ msg }}</p>
              }
            </div>
          }

          <div class="field">
            <label class="label" for="grade-comments">Comentarios</label>
            <textarea
              id="grade-comments"
              class="input"
              rows="3"
              formControlName="comments"
              [attr.maxlength]="commentsMaxLength"
              placeholder="Opcional. Visible para coordinación."
            ></textarea>
            @if (showError('comments'); as msg) {
              <p class="field-error">{{ msg }}</p>
            }
          </div>

          @if (showFormError(); as msg) {
            <p class="field-error -mt-2">{{ msg }}</p>
          }

          <footer class="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">Cancelar</button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="form.invalid || saving()"
            >
              @if (saving()) {
                <app-spinner [size]="14" />
                <span>Guardando…</span>
              } @else {
                <app-icon name="check" [size]="16" />
                <span>{{ submitLabel() }}</span>
              }
            </button>
          </footer>
        </form>
      </div>
    </div>
  `,
})
export class GradeRecordFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly scale = input.required<EvaluationScale>();
  readonly row = input<GradeRecordRow | null>(null);
  readonly saving = input<boolean>(false);
  readonly errorBanner = input<string | null>(null);

  readonly closed = output<void>();
  readonly submitted = output<CreateGradeRecordRequest>();

  protected readonly scaleScore = EvaluationScale.SCORE_0_20;
  protected readonly scoreMin = SCORE_MIN;
  protected readonly scoreMax = SCORE_MAX;
  protected readonly commentsMaxLength = COMMENTS_MAX_LENGTH;

  protected readonly editing = computed(() => this.row() !== null);

  protected readonly allowedLiterals = computed(() => ALLOWED_LITERALS_BY_SCALE[this.scale()]);

  protected readonly title = computed(() => (this.editing() ? 'Editar nota' : 'Registrar nota'));
  protected readonly description = computed(() =>
    this.editing()
      ? `Estudiante: ${this.row()!.studentFullName}.`
      : 'Registra una nota individual. Si el estudiante ya tiene una, el ' +
        'servidor hace upsert (idempotente).',
  );
  protected readonly submitLabel = computed(() =>
    this.editing() ? 'Guardar cambios' : 'Registrar',
  );

  private readonly _formError = signal<string | null>(null);

  protected readonly form: FormGroup = this.fb.group({
    studentPublicUuid: ['', [Validators.required]],
    score: [null as number | null],
    literal: [''],
    comments: ['', [Validators.maxLength(COMMENTS_MAX_LENGTH)]],
  });

  ngOnInit(): void {
    const r = this.row();
    if (r) {
      this.form.patchValue({
        studentPublicUuid: r.studentPublicUuid,
        score: r.score,
        literal: r.literal ?? '',
        comments: r.comments ?? '',
      });
      this.form.get('studentPublicUuid')?.disable({ emitEvent: false });
    } else {
      // Default sensato según scale: score=null para SCORE_0_20, literal=''.
      this.form.patchValue({ score: null, literal: '' });
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancel();
  }

  protected cancel(): void {
    this.closed.emit();
  }

  protected showError(field: string): string | null {
    const c = this.form.get(field);
    if (!c || c.untouched || !c.errors) return null;
    if (c.errors['required']) return 'Requerido.';
    if (c.errors['maxlength']) return 'Texto demasiado largo.';
    return 'Inválido.';
  }

  protected showFormError(): string | null {
    return this._formError();
  }

  protected onSubmit(): void {
    this._formError.set(null);
    const v = this.form.getRawValue() as {
      studentPublicUuid: string;
      score: number | null;
      literal: string;
      comments: string;
    };

    if (!UUID_REGEX.test(v.studentPublicUuid)) {
      this._formError.set('UUID de estudiante inválido.');
      return;
    }

    const literal = v.literal && v.literal.trim() ? v.literal.trim() : null;
    const score =
      v.score === null || v.score === undefined || (v.score as unknown) === ''
        ? null
        : Number(v.score);

    const shapeErr = validateGradeShape(this.scale(), { score, literal });
    if (shapeErr) {
      this._formError.set(shapeErr);
      return;
    }

    this.submitted.emit({
      studentPublicUuid: v.studentPublicUuid,
      score,
      literal,
      comments: v.comments?.trim() || null,
    });
  }
}
