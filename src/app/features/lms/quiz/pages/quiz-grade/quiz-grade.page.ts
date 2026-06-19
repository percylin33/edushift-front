import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';
import { AttemptsStore } from '../../store/attempts.store';
import {
  AttemptDetail,
  AttemptStatus,
  GradingQueueItem,
  ManualGradeAttemptRequest,
  ManualGradeEntry
} from '../../models/attempt.model';

/**
 * `/lms/quizzes/:uuid/grade` — Cola de calificación manual de
 * SHORT_ANSWER (FE-7b.3).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Cargar la cola via {@link AttemptsStore.loadQueue} (GET
 *       {@code /quizzes/{uuid}/grading-queue}).</li>
 *   <li>Para cada item, render un card expandible con:
 *     <ul>
 *       <li>Pregunta (prompt, points).</li>
 *       <li>Respuesta del estudiante (textAnswer).</li>
 *       <li>Input numérico {@code pointsAwarded} con validación cliente:
 *           [0, questionPoints], enteros.</li>
 *     </ul>
 *   </li>
 *   <li>Agrupar por attempt (los items vienen por-answer, pero un
 *       attempt puede tener N SHORT_ANSWER pendientes; el submit bulk
 *       los manda todos en una sola llamada).</li>
 *   <li>Persistir bulk via {@link AttemptsStore.gradeAttempt} (POST
 *       {@code /attempts/{uuid}/grade} con
 *       {@link ManualGradeAttemptRequest}).</li>
 *   <li>Feedback opcional a nivel de attempt (se aplica a todos los
 *       grades del attempt en una sola llamada).</li>
 * </ul>
 *
 * <p>El override single-answer ({@code PATCH /quizzes/{uuid}/attempts/{uuid}/answers/{uuid}})
 * ya está cableado en {@link AttemptsStore.overrideAnswerGrade} y se usa
 * desde el detail page de un attempt individual (FE-7b.3) o desde el
 * detail inline del {@code quiz-results.page.ts}.</p>
 */
@Component({
  selector: 'app-quiz-grade',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IconComponent,
    SpinnerComponent,
    EmptyStateComponent
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-content-muted">
          <a [routerLink]="resultsRoute()" class="hover:underline">← Volver a resultados</a>
        </p>
        <h1 class="text-2xl font-semibold text-content">Cola de calificación</h1>
        <p class="text-sm text-content-muted">
          {{ queue().length }} respuesta(s) corta(s) pendiente(s) en este quiz.
        </p>
      </div>
    </header>

    @if (loading()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando cola…" />
      </div>
    } @else {
      @let _err = errorBanner();
      @let _q = queue();
      @if (_err) {
        <div class="alert alert-danger" role="alert">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No se pudo cargar la cola.</p>
            <p class="text-xs opacity-80">{{ _err }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
            <app-icon name="refresh" [size]="14" />
            Reintentar
          </button>
        </div>
      } @else if (_q.length === 0) {
        <app-empty-state
          icon="check"
          title="No hay respuestas pendientes"
          description="Todas las preguntas de respuesta abierta ya fueron calificadas."
        >
          <a [routerLink]="resultsRoute()" class="btn btn-primary btn-sm">
            <app-icon name="bar-chart" [size]="14" />
            Ver resultados
          </a>
        </app-empty-state>
      } @else {
      <form [formGroup]="form" (submit)="$event.preventDefault()">
        <!-- Group queue items by attemptPublicUuid for bulk submission. -->
        @for (group of groups(); track group.attemptPublicUuid) {
          <article class="card mb-4">
            <div class="card-body space-y-3">
              <header class="flex flex-wrap items-center gap-2 text-sm">
                <span class="text-content-muted">Intento</span>
                <span class="font-mono text-xs">{{ group.attemptPublicUuid.slice(0, 8) }}</span>
                <span class="text-content-muted">·</span>
                <span class="text-content-muted">Estudiante</span>
                <span class="font-mono text-xs">{{ group.studentUserId.slice(0, 8) }}</span>
                <span class="text-content-muted">·</span>
                <span class="text-content-muted">{{ group.items.length }} respuesta(s)</span>
              </header>

              <ol class="space-y-3">
                @for (item of group.items; track item.answerPublicUuid) {
                  <li class="rounded-md border border-surface-muted p-3">
                    <header class="flex flex-wrap items-center gap-2 text-xs text-content-muted">
                      <span class="rounded bg-surface-muted px-1.5 py-0.5">
                        {{ item.questionPoints }} pts máx.
                      </span>
                      <span class="font-mono">{{ item.answerPublicUuid.slice(0, 8) }}</span>
                    </header>
                    <p class="mt-1 text-sm font-medium text-content">
                      {{ item.questionPrompt }}
                    </p>
                    <p class="mt-1 rounded-md bg-surface-muted/50 p-2 text-sm text-content-muted">
                      {{ item.textAnswer || '(sin respuesta)' }}
                    </p>
                    <div class="mt-2 flex items-center gap-2">
                      <label
                        class="text-xs text-content-muted"
                        [attr.for]="'grade-' + item.answerPublicUuid"
                      >
                        Puntos:
                      </label>
                      <input
                        [id]="'grade-' + item.answerPublicUuid"
                        type="number"
                        min="0"
                        [max]="item.questionPoints"
                        step="1"
                        class="input w-24"
                        [formControlName]="gradeControlKey(item.answerPublicUuid, item.questionPoints)"
                      />
                      <span class="text-xs text-content-muted">/ {{ item.questionPoints }}</span>
                    </div>
                  </li>
                }
              </ol>

              <div>
                <label
                  class="text-xs text-content-muted"
                  [attr.for]="'fb-' + group.attemptPublicUuid"
                >
                  Feedback (opcional, se aplica al intentar al enviar)
                </label>
                <textarea
                  [id]="'fb-' + group.attemptPublicUuid"
                  rows="2"
                  maxlength="2000"
                  class="textarea"
                  placeholder="Comentario para el estudiante…"
                  [formControlName]="feedbackControlKey(group.attemptPublicUuid)"
                ></textarea>
              </div>

              <div class="flex justify-end">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  (click)="submitGroup(group)"
                  [disabled]="!groupIsValid(group) || storeSaving()"
                >
                  @if (storeSaving()) {
                    <app-spinner [size]="14" />
                  } @else {
                    <app-icon name="check" [size]="14" />
                  }
                  Calificar intento
                </button>
              </div>
            </div>
          </article>
        }
      </form>
    }
    }
  `
})
export class QuizGradePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly attempts = inject(AttemptsStore);

  protected readonly quizPublicUuid = computed<string>(
    () => this.route.snapshot.paramMap.get('uuid') ?? ''
  );

  // Store signals aliased.
  protected readonly queue = this.attempts.queue;
  protected readonly loading = this.attempts.loadingQueue;
  protected readonly errorBanner = this.attempts.error;
  protected readonly storeSaving = this.attempts.saving;

  /** Grouped queue items by attempt (so each attempt has a bulk-grade form). */
  protected readonly groups = computed<GroupView[]>(() => {
    const items = this.queue();
    const byAttempt = new Map<string, GroupView>();
    for (const item of items) {
      const existing = byAttempt.get(item.attemptPublicUuid);
      if (existing) {
        existing.items.push(item);
      } else {
        byAttempt.set(item.attemptPublicUuid, {
          attemptPublicUuid: item.attemptPublicUuid,
          studentUserId: item.studentUserId,
          items: [item]
        });
      }
    }
    return Array.from(byAttempt.values());
  });

  /** Reactive form: keys are `<answerPublicUuid>:<questionPoints>` for grades and
   * `fb:<attemptPublicUuid>` for attempt-level feedback. */
  // FormGroup intentionally untyped (mixes numeric + string controls).
  protected readonly form: FormGroup = this.fb.group({});

  ngOnInit(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    await this.attempts.loadQueue(this.quizPublicUuid());
    this.rebuildForm();
  }

  protected rebuildForm(): void {
    // The form is intentionally untyped at the FormGroup level (we mix
    // numeric `pointsAwarded` controls with string `feedback` controls);
    // we keep per-control types locally and cast when adding.
    const numericControls: Record<string, FormControl<number | null>> = {};
    const stringControls: Record<string, FormControl<string | null>> = {};
    for (const group of this.groups()) {
      for (const item of group.items) {
        const key = this.gradeControlKey(item.answerPublicUuid, item.questionPoints);
        numericControls[key] = this.fb.nonNullable.control(0, [
          Validators.required,
          Validators.min(0),
          Validators.max(item.questionPoints),
          Validators.pattern(/^\d+$/)
        ]);
      }
      stringControls[this.feedbackControlKey(group.attemptPublicUuid)] =
        this.fb.nonNullable.control('', [Validators.maxLength(2000)]);
    }
    this.form.reset();
    // Replace all controls in the existing FormGroup.
    for (const name of Object.keys(this.form.controls)) {
      this.form.removeControl(name);
    }
    for (const [name, c] of Object.entries(numericControls)) {
      this.form.addControl(name, c as unknown as FormControl);
    }
    for (const [name, c] of Object.entries(stringControls)) {
      this.form.addControl(name, c as unknown as FormControl);
    }
  }

  protected gradeControlKey(answerPublicUuid: string, questionPoints: number): string {
    return `g:${answerPublicUuid}:${questionPoints}`;
  }

  protected feedbackControlKey(attemptPublicUuid: string): string {
    return `fb:${attemptPublicUuid}`;
  }

  protected groupIsValid(group: GroupView): boolean {
    for (const item of group.items) {
      const c = this.form.get(this.gradeControlKey(item.answerPublicUuid, item.questionPoints));
      if (!c || c.invalid) return false;
    }
    return true;
  }

  protected async submitGroup(group: GroupView): Promise<void> {
    if (!this.groupIsValid(group)) return;
    const grades: { answerPublicUuid: string; pointsAwarded: number }[] = [];
    for (const item of group.items) {
      const c = this.form.get(
        this.gradeControlKey(item.answerPublicUuid, item.questionPoints)
      ) as FormControl<number | null>;
      const value = c.value;
      if (value === null) continue;
      grades.push({ answerPublicUuid: item.answerPublicUuid, pointsAwarded: value });
    }
    const feedback =
      (this.form.get(this.feedbackControlKey(group.attemptPublicUuid)) as FormControl<string>)?.value ??
      null;
    const request: ManualGradeAttemptRequest = {
      grades,
      feedback: feedback && feedback.length > 0 ? feedback : null
    };
    const updated = await this.attempts.gradeAttempt(group.attemptPublicUuid, request);
    if (updated) {
      // Refresh the queue (the just-graded attempt is no longer pending).
      await this.attempts.loadQueue(this.quizPublicUuid());
      this.rebuildForm();
    }
  }

  protected reload(): void {
    void this.bootstrap();
  }

  protected resultsRoute(): string {
    return ROUTES.LMS.quizResults(this.quizPublicUuid());
  }
}

interface GroupView {
  attemptPublicUuid: string;
  studentUserId: string;
  items: GradingQueueItem[];
}
