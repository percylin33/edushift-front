import { CommonModule, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';
import { AttemptStatusBadgeComponent } from '../../components/attempt-status-badge/attempt-status-badge.component';
import { QuestionTypeBadgeComponent } from '../../components/question-type-badge/question-type-badge.component';
import { AttemptsStore } from '../../store/attempts.store';
import { QuizzesStore } from '../../store/quizzes.store';
import { QuizDetail, QuestionRow } from '../../models/quiz.model';
import {
  AnswerInputRaw,
  AnswerRow,
  AttemptDetail,
  AttemptStatus,
  isAttemptInProgress,
} from '../../models/attempt.model';

const AUTOSAVE_DEBOUNCE_MS = 1500;
const TICK_INTERVAL_MS = 1000;

/**
 * `/lms/quizzes/:uuid/take` — STUDENT/PARENT view para tomar un quiz
 * (FE-7b.2).
 *
 * <h3>Responsabilidades</h3>
 * <ol>
 *   <li>Cargar el quiz (metadata + preguntas) y, en paralelo, iniciar un
 *       {@code QuizAttempt} (POST /attempts). Si el backend responde
 *       409 {@code QUIZ_ATTEMPT_ALREADY_STARTED}, la page se recupera
 *       silenciosamente y muestra el intento existente en el detail
 *       (read-only).</li>
 *   <li>Render del banco de preguntas con un input distinto por tipo:
 *       radio MC, radio TF, textarea SHORT_ANSWER.</li>
 *   <li>Autosave con debounce de 1.5s: cada cambio de input encola un
 *       {@link AnswerInputRaw} en el {@link AttemptsStore}; tras 1.5s
 *       de inactividad el store hace PATCH al backend.</li>
 *   <li>Timer (si el quiz tiene {@code timeLimitMinutes}): cuenta atrás
 *       en segundos. Cuando llega a 0 la page dispara un submit forzado
 *       (sin pedir confirmación) que cierra el attempt.</li>
 *   <li>Submit: botón al final pide {@code confirm()}. Si confirma,
 *       flush de pending + POST /submit + redirect a results.</li>
 *   <li>Resumen post-submit: si el attempt ya no es IN_PROGRESS (p.ej.
 *       vino pre-cargado del store, o el backend lo cerró por timer),
 *       la page renderiza un read-only con los metadatos del attempt
 *       en lugar del form. Los correctness chips aparecen solo si
 *       {@code revealCorrectness} (graders o taker post-GRADED).</li>
 * </ol>
 */
@Component({
  selector: 'app-quiz-take',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    IconComponent,
    SpinnerComponent,
    EmptyStateComponent,
    AttemptStatusBadgeComponent,
    QuestionTypeBadgeComponent,
  ],
  template: `
    <header class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-content-muted">
          <a [routerLink]="quizDetailRoute()" class="hover:underline">← Volver al quiz</a>
        </p>
        <h1 class="text-2xl font-semibold text-content">
          {{ quizTitle() ?? 'Tomar quiz' }}
        </h1>
        @if (quizDescription(); as d) {
          <p class="mt-1 max-w-2xl text-sm text-content-muted">{{ d }}</p>
        }
      </div>
      <div class="flex flex-col items-end gap-2 text-right">
        @if (attempt(); as a) {
          <app-attempt-status-badge [status]="a.status" />
          <span class="text-xs text-content-muted">
            Intento #{{ a.attemptNumber }}
            @if (a.maxScore !== null) {
              · máx. {{ a.maxScore }} pts
            }
          </span>
        }
        @if (showTimer() && timerLabel(); as t) {
          <span
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium ring-1 ring-inset"
            [class]="timerClass()"
            [attr.aria-label]="'Tiempo restante: ' + t"
          >
            <app-icon name="clock" [size]="14" />
            {{ t }}
          </span>
        }
      </div>
    </header>

    <!-- Save indicator: small chip in the top right under the timer -->
    @if (attempt(); as a) {
      @if (a.status === 'IN_PROGRESS') {
        <div class="mb-3 flex flex-wrap items-center gap-2 text-xs text-content-muted">
          @let _lastSaveError = lastSaveError();
          @let _lastSavedAt = lastSavedAt();
          @if (storeSaving()) {
            <span class="inline-flex items-center gap-1">
              <app-icon name="save" [size]="12" />
              Guardando…
            </span>
          } @else if (_lastSaveError) {
            <span class="inline-flex items-center gap-1 text-red-600">
              <app-icon name="alert-triangle" [size]="12" />
              {{ _lastSaveError }}
            </span>
          } @else if (_lastSavedAt) {
            <span class="inline-flex items-center gap-1 text-emerald-700">
              <app-icon name="check" [size]="12" />
              Guardado {{ _lastSavedAt | date: 'HH:mm:ss' }}
            </span>
          } @else if (hasPending()) {
            <span class="inline-flex items-center gap-1 text-amber-700">
              <app-icon name="alert-triangle" [size]="12" />
              Cambios sin guardar
            </span>
          }
        </div>
      }
    }

    @if (loading()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Iniciando intento…" />
      </div>
    } @else {
      @let _errBanner = errorBanner();
      @let _attempt = attempt();
      @if (_errBanner) {
        <div class="alert alert-danger" role="alert">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No se pudo iniciar el intento.</p>
            <p class="text-xs opacity-80">{{ _errBanner }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
            <app-icon name="refresh" [size]="14" />
            Reintentar
          </button>
        </div>
      } @else if (_attempt) {
        @let a = _attempt;
        @if (isInProgress(a)) {
          <form (submit)="$event.preventDefault()">
            <ol class="space-y-4">
              @for (q of questions(); track q.publicUuid; let i = $index) {
                <li class="card">
                  <div class="card-body space-y-3">
                    <header class="flex items-start justify-between gap-3">
                      <h2 class="text-base font-medium text-content">
                        <span class="text-content-muted">{{ i + 1 }}.</span>
                        {{ q.prompt }}
                      </h2>
                      <div class="flex items-center gap-2 text-xs text-content-muted">
                        <app-question-type-badge [type]="q.type" />
                        <span class="rounded bg-surface-muted px-1.5 py-0.5">
                          {{ q.points }} pts
                        </span>
                      </div>
                    </header>

                    @switch (q.type) {
                      @case ('MC') {
                        <ul class="space-y-2">
                          @for (opt of q.options; track opt.publicUuid) {
                            <li>
                              <label
                                class="flex cursor-pointer items-start gap-2 rounded-md border border-surface-muted p-2 hover:border-primary-300"
                              >
                                <input
                                  type="radio"
                                  class="radio mt-0.5"
                                  [name]="'q-' + q.publicUuid"
                                  [value]="opt.publicUuid"
                                  [checked]="isOptionSelected(q.publicUuid, opt.publicUuid)"
                                  (change)="onOptionChange(q.publicUuid, opt.publicUuid)"
                                />
                                <span class="text-sm text-content">{{ opt.label }}</span>
                              </label>
                            </li>
                          }
                        </ul>
                      }
                      @case ('TF') {
                        <ul class="flex gap-4">
                          <li>
                            <label class="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                class="radio"
                                [name]="'q-' + q.publicUuid"
                                [value]="true"
                                [checked]="isBooleanSelected(q.publicUuid, true)"
                                (change)="onBooleanChange(q.publicUuid, true)"
                              />
                              <span class="text-sm text-content">Verdadero</span>
                            </label>
                          </li>
                          <li>
                            <label class="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                class="radio"
                                [name]="'q-' + q.publicUuid"
                                [value]="false"
                                [checked]="isBooleanSelected(q.publicUuid, false)"
                                (change)="onBooleanChange(q.publicUuid, false)"
                              />
                              <span class="text-sm text-content">Falso</span>
                            </label>
                          </li>
                        </ul>
                      }
                      @case ('SHORT_ANSWER') {
                        <textarea
                          rows="4"
                          class="textarea"
                          placeholder="Escribe tu respuesta…"
                          [value]="textValue(q.publicUuid)"
                          (input)="onTextChange(q.publicUuid, $any($event.target).value)"
                        ></textarea>
                      }
                    }
                  </div>
                </li>
              }
            </ol>

            <footer class="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <p class="text-xs text-content-muted">
                {{ questions().length }} pregunta(s) · total {{ totalPoints() }} pts
              </p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  (click)="flushNow()"
                  [disabled]="!hasPending() || storeSaving()"
                >
                  <app-icon name="save" [size]="14" />
                  Guardar ahora
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  (click)="onSubmit()"
                  [disabled]="storeSubmitting()"
                >
                  @if (storeSubmitting()) {
                    <app-spinner [size]="14" />
                  } @else {
                    <app-icon name="send" [size]="14" />
                  }
                  Enviar intento
                </button>
              </div>
            </footer>
          </form>
        } @else {
          <!-- Read-only summary (SUBMITTED / AUTO_GRADED / GRADED / EXPIRED) -->
          <section class="space-y-3">
            <app-empty-state
              icon="check"
              title="Intento enviado"
              [description]="submittedDescription(a)"
            >
              <a [routerLink]="resultsRoute()" class="btn btn-primary btn-sm">
                <app-icon name="bar-chart" [size]="14" />
                Ver resultados
              </a>
              <a [routerLink]="quizDetailRoute()" class="btn btn-ghost btn-sm">
                <app-icon name="arrow-left" [size]="14" />
                Volver al quiz
              </a>
            </app-empty-state>

            @if (canReveal(a)) {
              <article class="card">
                <div class="card-body space-y-3">
                  <h2 class="text-base font-medium text-content">Tus respuestas</h2>
                  <ol class="space-y-3">
                    @for (ans of a.answers; track ans.publicUuid; let i = $index) {
                      @let q = findQuestion(ans.questionPublicUuid);
                      <li class="rounded-md border border-surface-muted p-3">
                        <p class="text-sm font-medium text-content">
                          <span class="text-content-muted">{{ i + 1 }}.</span>
                          {{ q?.prompt ?? 'Pregunta' }}
                        </p>
                        <p class="mt-1 text-sm text-content-muted">
                          Tu respuesta: <span class="text-content">{{ formatAnswer(ans, q) }}</span>
                        </p>
                        @if (ans.correct !== null) {
                          <p class="mt-1 text-xs">
                            <span
                              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset"
                              [class]="
                                ans.correct
                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                  : 'bg-red-50 text-red-700 ring-red-200'
                              "
                            >
                              <app-icon [name]="ans.correct ? 'check' : 'x'" [size]="12" />
                              {{ ans.correct ? 'Correcta' : 'Incorrecta' }} ·
                              {{ ans.pointsAwarded ?? 0 }} pts
                            </span>
                          </p>
                        }
                      </li>
                    }
                  </ol>
                </div>
              </article>
            }
          </section>
        }
      }
    }
  `,
})
export class QuizTakePageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly quizzes = inject(QuizzesStore);
  private readonly attempts = inject(AttemptsStore);

  protected readonly quizPublicUuid = computed<string>(
    () => this.route.snapshot.paramMap.get('uuid') ?? '',
  );

  // The page owns: which quiz is being taken, plus the active attempt.
  protected readonly quiz = signal<QuizDetail | null>(null);
  protected readonly loading = signal<boolean>(true);

  // Aliases for template access to store signals (avoids 3-property access in template).
  protected readonly attempt = this.attempts.current;
  protected readonly storeLoading = this.attempts.loadingCurrent;
  protected readonly storeSaving = this.attempts.saving;
  protected readonly storeSubmitting = this.attempts.submitting;
  protected readonly lastSavedAt = this.attempts.lastSavedAt;
  protected readonly lastSaveError = this.attempts.lastSaveError;
  protected readonly errorBanner = this.attempts.error;
  protected readonly hasPending = this.attempts.hasPending;

  protected readonly quizTitle = computed<string | null>(() => this.quiz()?.title ?? null);
  protected readonly quizDescription = computed<string | null>(
    () => this.quiz()?.description ?? null,
  );
  protected readonly questions = computed<QuestionRow[]>(() => this.quiz()?.questions ?? []);
  protected readonly totalPoints = computed<number>(() =>
    this.questions().reduce((acc, q) => acc + (q.points ?? 0), 0),
  );

  // Timer (when the quiz has a time limit). Decrements every TICK_INTERVAL_MS.
  protected readonly timerSeconds = signal<number | null>(null);
  private tickHandle: number | null = null;

  // Debounce handle for autosave.
  private autosaveHandle: number | null = null;
  private lastInteraction: { questionPublicUuid: string; payload: AnswerInputRaw } | null = null;

  // Loading = first attempt to start (combines loading the quiz + the start call).
  protected loadingQuiz = signal<boolean>(true);

  ngOnInit(): void {
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    if (this.autosaveHandle !== null) {
      clearTimeout(this.autosaveHandle);
      this.autosaveHandle = null;
    }
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    this.attempts.clearCurrent();
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  private async bootstrap(): Promise<void> {
    this.loading.set(true);
    if (this.errorBanner()) {
      this.attempts.clearError();
    }
    try {
      const quiz = await this.quizzes.loadDetail(this.quizPublicUuid());
      this.quiz.set(quiz);
      this.loadingQuiz.set(false);
      this.startTimerIfNeeded(quiz);

      const ok = await this.attempts.startAttempt(this.quizPublicUuid());
      if (!ok) {
        const err = this.attempts.error();
        // 409 / already started → backend has a pending attempt; the store left the
        // previous current untouched. Surface a friendly banner with a retry that
        // would resolve a real resume flow once BE-7b.2 exposes a "find my IN_PROGRESS"
        // helper (out of scope for FE-7b.2). For now we still allow the user to back out.
        if (err && /already.started|ya.iniciado|en curso|in.progress/i.test(err)) {
          this.attempts.clearError();
        }
      } else {
        this.startTimerIfNeededFromAttempt(this.attempts.current());
      }
    } catch (err) {
      this.attempts.clearError();
      this.attempts.clearCurrent();
      // No rethrow — the error signal already carries the message; the page
      // also shows the generic loading=false state.
    } finally {
      this.loading.set(false);
    }
  }

  private startTimerIfNeeded(quiz: QuizDetail | null): void {
    if (!quiz) return;
    if (quiz.timeLimitMinutes === null || quiz.timeLimitMinutes === undefined) return;
    // We can't start the timer until we know the attempt's expiresAt. Use a fallback
    // estimate: now + timeLimitMinutes, until the start call returns the real value.
    const estimate = Math.max(quiz.timeLimitMinutes * 60, 0);
    this.timerSeconds.set(estimate);
  }

  private startTimerIfNeededFromAttempt(attempt: AttemptDetail | null): void {
    if (!attempt) return;
    if (attempt.expiresAt !== null) {
      const remaining = Math.max(Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000), 0);
      this.timerSeconds.set(remaining);
    }
    this.startTick();
  }

  private startTick(): void {
    if (this.tickHandle !== null) return;
    this.tickHandle = window.setInterval(() => {
      const current = this.timerSeconds();
      if (current === null) {
        this.stopTick();
        return;
      }
      const next = current - 1;
      this.timerSeconds.set(next);
      if (next <= 0) {
        this.stopTick();
        void this.onTimeUp();
      }
    }, TICK_INTERVAL_MS);
  }

  private stopTick(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  protected isOptionSelected(questionPublicUuid: string, optionPublicUuid: string): boolean {
    const pending = this.attempts.pendingAnswers()[questionPublicUuid];
    if (pending?.selectedOptionId === optionPublicUuid) return true;
    const saved = this.attempts.findAnswer(questionPublicUuid);
    if (saved?.selectedOptionId === optionPublicUuid) return true;
    return false;
  }

  protected isBooleanSelected(questionPublicUuid: string, value: boolean): boolean {
    const pending = this.attempts.pendingAnswers()[questionPublicUuid];
    if (pending?.selectedBoolean === value) return true;
    const saved = this.attempts.findAnswer(questionPublicUuid);
    if (saved?.selectedBoolean === value) return true;
    return false;
  }

  protected textValue(questionPublicUuid: string): string {
    const pending = this.attempts.pendingAnswers()[questionPublicUuid];
    if (pending && pending.textAnswer !== null && pending.textAnswer !== undefined) {
      return pending.textAnswer;
    }
    const saved = this.attempts.findAnswer(questionPublicUuid);
    return saved?.textAnswer ?? '';
  }

  protected onOptionChange(questionPublicUuid: string, optionPublicUuid: string): void {
    const payload: AnswerInputRaw = {
      questionPublicUuid,
      questionType: 'MC',
      selectedOptionId: optionPublicUuid,
      selectedBoolean: null,
      textAnswer: null,
    };
    this.queueAutosave(questionPublicUuid, payload);
  }

  protected onBooleanChange(questionPublicUuid: string, value: boolean): void {
    const payload: AnswerInputRaw = {
      questionPublicUuid,
      questionType: 'TF',
      selectedOptionId: null,
      selectedBoolean: value,
      textAnswer: null,
    };
    this.queueAutosave(questionPublicUuid, payload);
  }

  protected onTextChange(questionPublicUuid: string, text: string): void {
    const payload: AnswerInputRaw = {
      questionPublicUuid,
      questionType: 'SHORT_ANSWER',
      selectedOptionId: null,
      selectedBoolean: null,
      textAnswer: text,
    };
    this.queueAutosave(questionPublicUuid, payload);
  }

  // ---------------------------------------------------------------------------
  // Autosave orchestration
  // ---------------------------------------------------------------------------

  private queueAutosave(questionPublicUuid: string, payload: AnswerInputRaw): void {
    this.attempts.setPendingAnswer(questionPublicUuid, payload.questionType, payload);
    this.lastInteraction = { questionPublicUuid, payload };
    if (this.autosaveHandle !== null) {
      clearTimeout(this.autosaveHandle);
    }
    this.autosaveHandle = window.setTimeout(() => void this.flushNow(), AUTOSAVE_DEBOUNCE_MS);
  }

  protected async flushNow(): Promise<void> {
    if (this.autosaveHandle !== null) {
      clearTimeout(this.autosaveHandle);
      this.autosaveHandle = null;
    }
    const a = this.attempts.current();
    if (!a) return;
    if (!isAttemptInProgress(a)) return;
    await this.attempts.flushPendingAnswers(a.publicUuid);
  }

  // ---------------------------------------------------------------------------
  // Submit + timer expiry
  // ---------------------------------------------------------------------------

  protected async onSubmit(): Promise<void> {
    const a = this.attempts.current();
    if (!a) return;
    if (!isAttemptInProgress(a)) return;
    const ok = window.confirm('¿Enviar el intento? No podrás modificar las respuestas después.');
    if (!ok) return;
    await this.flushNow();
    const updated = await this.attempts.submitAttempt(a.publicUuid);
    if (updated) {
      this.router.navigateByUrl(this.resultsRoute());
    }
  }

  private async onTimeUp(): Promise<void> {
    const a = this.attempts.current();
    if (!a) return;
    if (!isAttemptInProgress(a)) return;
    // Best-effort flush + submit. Errors are swallowed (the attempt is about to be
    // EXPIRED on the backend anyway).
    await this.attempts.flushPendingAnswers(a.publicUuid).catch(() => null);
    await this.attempts.submitAttempt(a.publicUuid).catch(() => null);
  }

  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------

  protected reload(): void {
    this.attempts.clearCurrent();
    void this.bootstrap();
  }

  protected isInProgress(a: AttemptDetail): boolean {
    return a.status === AttemptStatus.InProgress;
  }

  protected canReveal(a: AttemptDetail): boolean {
    return a.revealCorrectness || a.status === AttemptStatus.Graded;
  }

  protected submittedDescription(a: AttemptDetail): string {
    switch (a.status) {
      case AttemptStatus.Submitted:
        return 'Tu intento fue recibido. El docente lo calificará en breve.';
      case AttemptStatus.AutoGraded:
        return 'Las preguntas de opción múltiple y verdadero/falso se calificaron automáticamente. Las preguntas de respuesta abierta están pendientes de revisión.';
      case AttemptStatus.Graded:
        if (a.score !== null && a.maxScore !== null) {
          return `Tu nota final es ${a.score} / ${a.maxScore}.`;
        }
        return 'Tu intento fue calificado.';
      case AttemptStatus.Expired:
        return 'El tiempo se agotó y el intento se cerró automáticamente.';
      default:
        return 'Tu intento fue enviado.';
    }
  }

  protected findQuestion(questionPublicUuid: string): QuestionRow | null {
    return this.questions().find((q) => q.publicUuid === questionPublicUuid) ?? null;
  }

  protected formatAnswer(ans: AnswerRow, q: QuestionRow | null): string {
    if (ans.selectedOptionId !== null && q) {
      const opt = q.options.find((o) => o.publicUuid === ans.selectedOptionId);
      return opt?.label ?? '(opción seleccionada)';
    }
    if (ans.selectedBoolean !== null) {
      return ans.selectedBoolean ? 'Verdadero' : 'Falso';
    }
    if (ans.textAnswer !== null) {
      return ans.textAnswer;
    }
    return '(sin respuesta)';
  }

  protected readonly showTimer = computed<boolean>(() => {
    const a = this.attempts.current();
    if (!a) return false;
    return a.status === AttemptStatus.InProgress && this.timerSeconds() !== null;
  });

  protected readonly timerLabel = computed<string | null>(() => {
    const s = this.timerSeconds();
    if (s === null) return null;
    const mm = Math.floor(s / 60)
      .toString()
      .padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  });

  protected readonly timerClass = computed<string>(() => {
    const s = this.timerSeconds();
    if (s === null) return '';
    if (s <= 60) return 'text-red-700 bg-red-50 ring-red-300';
    if (s <= 300) return 'text-amber-700 bg-amber-50 ring-amber-300';
    return 'text-content-muted bg-surface-muted ring-surface-muted';
  });

  // ---------------------------------------------------------------------------
  // Route helpers
  // ---------------------------------------------------------------------------

  protected quizDetailRoute(): string {
    return ROUTES.LMS.quizDetail(this.quizPublicUuid());
  }

  protected resultsRoute(): string {
    return ROUTES.LMS.quizResults(this.quizPublicUuid());
  }
}
