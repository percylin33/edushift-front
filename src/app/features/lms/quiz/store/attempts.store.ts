import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttemptApiService } from '../services/attempt-api.service';
import {
  AnswerInputRaw,
  AnswerRow,
  AttemptDetail,
  AttemptStatus,
  AttemptSummaryRow,
  GradingQueueItem,
  ManualGradeAttemptRequest,
  isAttemptFinal,
  isAttemptInProgress
} from '../models/attempt.model';

/**
 * Reactive store del feature {@code lms.quiz.attempts} (FE-7b.2).
 *
 * <h3>Slices</h3>
 * <ol>
 *   <li><b>Current attempt</b> — el intento en curso (player) o el abierto
 *       en la vista de detail. Mantiene el {@link AttemptDetail} completo
 *       (status + answers + reveal flag).</li>
 *   <li><b>Pending answers</b> — mapa indexado por
 *       {@code questionPublicUuid} con la última respuesta tipeada por el
 *       taker. Se persisten al backend vía {@link #flushPendingAnswers} con
 *       debounce 1.5s (lo orquesta el page).</li>
 *   <li><b>Teacher-side summary</b> — listado paginado de attempts de un
 *       quiz (para FE-7b.3, expuesto ya para evitar reescritura).</li>
 *   <li><b>Grading queue</b> — items de SHORT_ANSWER pendientes de verdict
 *       manual (FE-7b.3).</li>
 * </ol>
 *
 * <p>El store NUNCA hace auto-grading local. Las {@code AnswerInputRaw} se
 * serializan con la shape que espera el backend (mutually exclusive: o
 * {@code selectedOptionId}, o {@code selectedBoolean}, o
 * {@code textAnswer}).</p>
 */
@Injectable({ providedIn: 'root' })
export class AttemptsStore {
  private readonly api = inject(AttemptApiService);

  // ---------------------------------------------------------------------------
  // Current attempt slice (player + detail)
  // ---------------------------------------------------------------------------
  private readonly _current = signal<AttemptDetail | null>(null);
  private readonly _loadingCurrent = signal<boolean>(false);
  private readonly _saving = signal<boolean>(false);
  private readonly _submitting = signal<boolean>(false);
  private readonly _lastSavedAt = signal<Date | null>(null);
  private readonly _lastSaveError = signal<string | null>(null);
  private readonly _error = signal<string | null>(null);

  /** Answers typed by the user but not yet flushed to the backend. */
  private readonly _pendingAnswers = signal<Record<string, AnswerInputRaw>>({});
  /** Question types indexed by questionPublicUuid (needed to build the wire payload). */
  private readonly _questionTypes = signal<Record<string, 'MC' | 'TF' | 'SHORT_ANSWER'>>({});

  // ---------------------------------------------------------------------------
  // Teacher-side slices (FE-7b.3 will use these; exposed now for spec-ability)
  // ---------------------------------------------------------------------------
  private readonly _summaries = signal<AttemptSummaryRow[]>([]);
  private readonly _loadingSummaries = signal<boolean>(false);
  private readonly _summariesTotal = signal<number>(0);
  private readonly _summariesPage = signal<number>(0);
  private readonly _summariesSize = signal<number>(20);

  private readonly _queue = signal<GradingQueueItem[]>([]);
  private readonly _loadingQueue = signal<boolean>(false);

  // ---------------------------------------------------------------------------
  // Public read-only API
  // ---------------------------------------------------------------------------
  readonly current = this._current.asReadonly();
  readonly loadingCurrent = this._loadingCurrent.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly submitting = this._submitting.asReadonly();
  readonly lastSavedAt = this._lastSavedAt.asReadonly();
  readonly lastSaveError = this._lastSaveError.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pendingAnswers = this._pendingAnswers.asReadonly();

  readonly hasPending = computed(() => Object.keys(this._pendingAnswers()).length > 0);

  readonly currentIsInProgress = computed(() => {
    const c = this._current();
    return !!c && isAttemptInProgress(c);
  });

  readonly currentIsFinal = computed(() => {
    const c = this._current();
    return !!c && isAttemptFinal(c);
  });

  readonly summaries = this._summaries.asReadonly();
  readonly loadingSummaries = this._loadingSummaries.asReadonly();
  readonly summariesTotal = this._summariesTotal.asReadonly();
  readonly summariesPage = this._summariesPage.asReadonly();
  readonly summariesSize = this._summariesSize.asReadonly();

  readonly queue = this._queue.asReadonly();
  readonly loadingQueue = this._loadingQueue.asReadonly();

  // ---------------------------------------------------------------------------
  // Player flow mutations
  // ---------------------------------------------------------------------------

  /**
   * Start a new attempt for the caller on the given quiz. If the backend
   * already has an IN_PROGRESS attempt and the page wants to resume it,
   * use {@link #loadAttempt} instead.
   */
  async startAttempt(quizPublicUuid: string): Promise<AttemptDetail | null> {
    this._error.set(null);
    this._loadingCurrent.set(true);
    try {
      const attempt = await firstValueFrom(this.api.startAttempt(quizPublicUuid));
      this._current.set(attempt);
      this._questionTypes.set(this.extractQuestionTypes(attempt));
      this._pendingAnswers.set({});
      this._lastSavedAt.set(null);
      return attempt;
    } catch (err) {
      this._error.set(this.toMessage(err, 'No se pudo iniciar el intento.'));
      return null;
    } finally {
      this._loadingCurrent.set(false);
    }
  }

  /**
   * Load an existing attempt by uuid. Used to resume an IN_PROGRESS attempt
   * after a 409 on {@link #startAttempt} or to display a previously
   * GRADED attempt on the results page.
   */
  async loadAttempt(attemptPublicUuid: string): Promise<AttemptDetail | null> {
    this._error.set(null);
    this._loadingCurrent.set(true);
    try {
      const attempt = await firstValueFrom(this.api.getAttempt(attemptPublicUuid));
      this._current.set(attempt);
      this._questionTypes.set(this.extractQuestionTypes(attempt));
      this._pendingAnswers.set({});
      this._lastSavedAt.set(attempt.answers.length > 0 ? new Date() : null);
      return attempt;
    } catch (err) {
      this._error.set(this.toMessage(err, 'No se pudo cargar el intento.'));
      return null;
    } finally {
      this._loadingCurrent.set(false);
    }
  }

  /**
   * Record that the user typed a new answer locally. Does NOT call the
   * backend. The page is expected to debounce and call
   * {@link #flushPendingAnswers} after 1.5s of inactivity.
   *
   * <p>Pass {@code null} to remove a pending answer (e.g. user cleared the
   * input).</p>
   */
  setPendingAnswer(
    questionPublicUuid: string,
    questionType: 'MC' | 'TF' | 'SHORT_ANSWER',
    value: AnswerInputRaw | null
  ): void {
    this._questionTypes.update((m) => ({ ...m, [questionPublicUuid]: questionType }));
    this._pendingAnswers.update((m) => {
      const next = { ...m };
      if (value === null) {
        delete next[questionPublicUuid];
      } else {
        next[questionPublicUuid] = value;
      }
      return next;
    });
  }

  /**
   * Flush the pending answers to the backend. Returns the updated
   * {@link AttemptDetail} on success, or {@code null} on failure (the
   * {@link #error} signal holds the message; the {@link #lastSaveError}
   * signal is cleared on next success).
   */
  async flushPendingAnswers(attemptPublicUuid: string): Promise<AttemptDetail | null> {
    const pending = this._pendingAnswers();
    const questionPublicUuids = Object.keys(pending);
    if (questionPublicUuids.length === 0) {
      return this._current();
    }
    const answers = questionPublicUuids.map((qid) => pending[qid]);
    this._saving.set(true);
    this._lastSaveError.set(null);
    try {
      const updated = await firstValueFrom(this.api.saveAnswers(attemptPublicUuid, answers));
      this._current.set(updated);
      this._questionTypes.set(this.extractQuestionTypes(updated));
      // Drop the ones we just persisted.
      this._pendingAnswers.update((m) => {
        const next: Record<string, AnswerInputRaw> = {};
        for (const [qid, v] of Object.entries(m)) {
          if (!questionPublicUuids.includes(qid)) {
            next[qid] = v;
          }
        }
        return next;
      });
      this._lastSavedAt.set(new Date());
      return updated;
    } catch (err) {
      this._lastSaveError.set(this.toMessage(err, 'No se pudo guardar la respuesta.'));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Final submit. The caller is expected to flush pending answers first
   * (the page usually does {@code await flushPendingAnswers(); await submitAttempt();}).
   */
  async submitAttempt(attemptPublicUuid: string): Promise<AttemptDetail | null> {
    this._submitting.set(true);
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.api.submitAttempt(attemptPublicUuid));
      this._current.set(updated);
      this._pendingAnswers.set({});
      this._lastSavedAt.set(new Date());
      return updated;
    } catch (err) {
      this._error.set(this.toMessage(err, 'No se pudo enviar el intento.'));
      return null;
    } finally {
      this._submitting.set(false);
    }
  }

  /** Clear the current attempt and all derived state (page teardown). */
  clearCurrent(): void {
    this._current.set(null);
    this._pendingAnswers.set({});
    this._questionTypes.set({});
    this._lastSavedAt.set(null);
    this._lastSaveError.set(null);
    this._error.set(null);
  }

  // ---------------------------------------------------------------------------
  // Teacher-side mutations (FE-7b.3 consumes these; spec'd now for testability)
  // ---------------------------------------------------------------------------

  async loadSummaries(
    quizPublicUuid: string,
    pageable: { page?: number; size?: number; sort?: string } = {}
  ): Promise<void> {
    this._loadingSummaries.set(true);
    this._error.set(null);
    try {
      // Drop undefined keys so the spy matcher in tests sees the same shape
      // we actually pass to the service (no implicit `sort: undefined`).
      const opts: { page?: number; size?: number; sort?: string } = {
        page: pageable.page ?? 0,
        size: pageable.size ?? 20
      };
      if (pageable.sort !== undefined) {
        opts.sort = pageable.sort;
      }
      const page = await firstValueFrom(this.api.listAttempts(quizPublicUuid, opts));
      this._summaries.set(page.content);
      this._summariesTotal.set(page.totalElements);
      this._summariesPage.set(page.number);
      this._summariesSize.set(page.size);
    } catch (err) {
      this._error.set(this.toMessage(err, 'No se pudo cargar el listado de intentos.'));
    } finally {
      this._loadingSummaries.set(false);
    }
  }

  async loadQueue(quizPublicUuid: string): Promise<void> {
    this._loadingQueue.set(true);
    this._error.set(null);
    try {
      const items = await firstValueFrom(this.api.getGradingQueue(quizPublicUuid));
      this._queue.set(items);
    } catch (err) {
      this._error.set(this.toMessage(err, 'No se pudo cargar la cola de calificación.'));
    } finally {
      this._loadingQueue.set(false);
    }
  }

  async gradeAttempt(
    attemptPublicUuid: string,
    request: ManualGradeAttemptRequest
  ): Promise<AttemptDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.api.gradeAttempt(attemptPublicUuid, request));
      this._current.set(updated);
      return updated;
    } catch (err) {
      this._error.set(this.toMessage(err, 'No se pudo calificar el intento.'));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async overrideAnswerGrade(
    quizPublicUuid: string,
    attemptPublicUuid: string,
    answerPublicUuid: string,
    pointsAwarded: number
  ): Promise<AttemptDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const updated = await firstValueFrom(
        this.api.overrideAnswerGrade(quizPublicUuid, attemptPublicUuid, answerPublicUuid, pointsAwarded)
      );
      this._current.set(updated);
      return updated;
    } catch (err) {
      this._error.set(this.toMessage(err, 'No se pudo actualizar la nota.'));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract the question types from the embedded answers. Useful as a
   * default when the page doesn't already know the type. We don't have a
   * questionType field on the wire, so we re-derive it from the answer
   * shape: selectedOptionId → MC, selectedBoolean → TF, textAnswer → SHORT.
   * Unknown answers (no payload yet) default to MC. This is a best-effort
   * seed; the page should override with its own question type knowledge.
   */
  private extractQuestionTypes(
    attempt: AttemptDetail
  ): Record<string, 'MC' | 'TF' | 'SHORT_ANSWER'> {
    const out: Record<string, 'MC' | 'TF' | 'SHORT_ANSWER'> = {};
    for (const ans of attempt.answers) {
      if (ans.selectedOptionId !== null) {
        out[ans.questionPublicUuid] = 'MC';
      } else if (ans.selectedBoolean !== null) {
        out[ans.questionPublicUuid] = 'TF';
      } else if (ans.textAnswer !== null) {
        out[ans.questionPublicUuid] = 'SHORT_ANSWER';
      } else {
        out[ans.questionPublicUuid] = 'MC';
      }
    }
    return out;
  }

  /** Find the saved answer for a question (from the current attempt). */
  findAnswer(questionPublicUuid: string): AnswerRow | null {
    const c = this._current();
    if (!c) return null;
    return c.answers.find((a) => a.questionPublicUuid === questionPublicUuid) ?? null;
  }

  /** True when the current attempt is awaiting manual grading on SHORT_ANSWER. */
  isAwaitingManualGrade(): boolean {
    const c = this._current();
    return !!c && c.status === AttemptStatus.AutoGraded;
  }

  clearError(): void {
    this._error.set(null);
    this._lastSaveError.set(null);
  }

  /**
   * Best-effort error message extraction. We don't import HttpErrorResponse
   * here to keep the store free of @angular/common/http types.
   */
  private toMessage(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const e = err as { error?: { message?: string; error?: { message?: string } } };
      const m = e.error?.message ?? e.error?.error?.message;
      if (typeof m === 'string' && m.length > 0) return m;
    }
    return fallback;
  }
}
