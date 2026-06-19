import { CommonModule, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';
import { AttemptStatusBadgeComponent } from '../../components/attempt-status-badge/attempt-status-badge.component';
import { AttemptsStore } from '../../store/attempts.store';
import { QuizzesStore } from '../../store/quizzes.store';
import {
  AnswerRow,
  AttemptStatus,
  AttemptSummaryRow,
  isAttemptFinal,
  canRevealCorrectnessFor
} from '../../models/attempt.model';
import { QuestionRow, QuizDetail } from '../../models/quiz.model';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';

/**
 * `/lms/quizzes/:uuid/results` — Vista de resultados del quiz (FE-7b.3).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Cargar el {@link QuizDetail} (para resolver {@link QuestionRow} y
 *       {@code OptionRow} a partir de los UUIDs en los {@code answers}).</li>
 *   <li>Cargar la lista de attempts del quiz via
 *       {@link AttemptsStore.loadSummaries}.</li>
 *   <li>Decidir el modo según el rol del caller:
 *     <ul>
 *       <li><b>TEACHER</b> (con {@code LMS_QUIZ_GRADE}): ve todos los
 *           attempts en una tabla con score, status, pending-answer count,
 *           y un botón "Calificar" que abre un detail expandible con
 *           cada answer (revela correctas).</li>
 *       <li><b>STUDENT/PARENT</b> (con {@code LMS_QUIZ_READ}): ve solo
 *           sus propios attempts (asumiendo que el BE filtra por caller
 *           para roles no-TEACHER; ver DEBT-FE-7B-4). El detail de cada
 *           attempt muestra sus respuestas y (si GRADED + reveal) las
 *           correctas.</li>
 *     </ul>
 *   </li>
 *   <li>Permitir expandir/colapsar cada fila (signal-driven) sin
 *       disparar un GET extra — el detail se carga on-demand solo si el
 *       caller hace click en "Ver detalle completo" (ver
 *       {@link #onExpandAttempt}).</li>
 * </ul>
 */
@Component({
  selector: 'app-quiz-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    IconComponent,
    SpinnerComponent,
    EmptyStateComponent,
    AttemptStatusBadgeComponent
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-content-muted">
          <a [routerLink]="quizDetailRoute()" class="hover:underline">← Volver al quiz</a>
        </p>
        <h1 class="text-2xl font-semibold text-content">Resultados del quiz</h1>
        @if (quizTitle(); as t) {
          <p class="text-sm text-content-muted">{{ t }}</p>
        }
      </div>
      @if (canGrade()) {
        <a [routerLink]="gradeRoute()" class="btn btn-secondary btn-sm">
          <app-icon name="clipboard-check" [size]="14" />
          Cola de calificación
        </a>
      }
    </header>

    @if (loading()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando resultados…" />
      </div>
    } @else {
      @let _err = errorBanner();
      @let _rows = summaries();
      @if (_err) {
        <div class="alert alert-danger" role="alert">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No se pudieron cargar los resultados.</p>
            <p class="text-xs opacity-80">{{ _err }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
            <app-icon name="refresh" [size]="14" />
            Reintentar
          </button>
        </div>
      } @else if (_rows.length === 0) {
        <app-empty-state
          icon="bar-chart"
          title="Aún no hay intentos"
          [description]="emptyDescription()"
        >
          <a [routerLink]="takeRoute()" class="btn btn-primary btn-sm">
            <app-icon name="play" [size]="14" />
            Tomar quiz
          </a>
        </app-empty-state>
      } @else {
        <article class="card">
        <div class="card-body p-0">
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  @if (canGrade()) {
                    <th>Estudiante</th>
                  }
                  <th>Intento</th>
                  <th>Status</th>
                  <th class="text-right">Auto</th>
                  <th class="text-right">Manual</th>
                  <th class="text-right">Final</th>
                  <th class="text-right">Pendientes</th>
                  <th>Inicio</th>
                  <th>Entregado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (s of summaries(); track s.publicUuid) {
                  <tr
                    class="cursor-pointer hover:bg-surface-muted/50"
                    (click)="toggleRow(s.publicUuid)"
                  >
                    @if (canGrade()) {
                      <td class="font-mono text-xs text-content-muted">
                        {{ shortId(s.studentUserId) }}
                      </td>
                    }
                    <td>#{{ s.attemptNumber }}</td>
                    <td>
                      <app-attempt-status-badge [status]="s.status" />
                    </td>
                    <td class="text-right tabular-nums">{{ s.autoScore ?? '—' }}</td>
                    <td class="text-right tabular-nums">{{ s.manualScore ?? '—' }}</td>
                    <td class="text-right tabular-nums font-semibold">
                      {{ s.score ?? '—' }} / {{ s.maxScore ?? '—' }}
                    </td>
                    <td class="text-right tabular-nums">
                      @if (s.pendingAnswerCount > 0) {
                        <span class="inline-flex items-center gap-1 text-amber-700">
                          <app-icon name="alert-triangle" [size]="12" />
                          {{ s.pendingAnswerCount }}
                        </span>
                      } @else {
                        0
                      }
                    </td>
                    <td class="text-xs text-content-muted">
                      {{ s.startedAt | date: 'short' }}
                    </td>
                    <td class="text-xs text-content-muted">
                      {{ s.submittedAt ? (s.submittedAt | date: 'short') : '—' }}
                    </td>
                    <td>
                      <app-icon
                        [name]="isExpanded(s.publicUuid) ? 'chevron-up' : 'chevron-down'"
                        [size]="14"
                      />
                    </td>
                  </tr>
                  @if (isExpanded(s.publicUuid)) {
                    <tr>
                      <td [attr.colspan]="canGrade() ? 10 : 9" class="bg-surface-muted/30 p-0">
                        <div class="p-4">
                          @if (loadingDetail() === s.publicUuid) {
                            <div class="flex items-center justify-center py-8">
                              <app-spinner [size]="16" label="Cargando detalle…" />
                            </div>
                          }
                          @let _a = expandedDetail();
                          @if (_a) {
                            <div class="space-y-3">
                              <div class="flex flex-wrap items-center gap-2 text-xs text-content-muted">
                                <span>
                                  Inicio: <strong>{{ _a.startedAt | date: 'medium' }}</strong>
                                </span>
                                @if (_a.submittedAt) {
                                  <span>
                                    · Entregado:
                                    <strong>{{ _a.submittedAt | date: 'medium' }}</strong>
                                  </span>
                                }
                                @if (_a.gradedAt) {
                                  <span>
                                    · Calificado:
                                    <strong>{{ _a.gradedAt | date: 'medium' }}</strong>
                                  </span>
                                }
                                @if (_a.feedback) {
                                  <span>
                                    · Feedback:
                                    <em class="text-content">"{{ _a.feedback }}"</em>
                                  </span>
                                }
                              </div>

                              @if (_a.answers.length === 0) {
                                <p class="text-sm text-content-muted">
                                  Este intento no tiene respuestas registradas.
                                </p>
                              } @else {
                                <ol class="space-y-2">
                                  @for (ans of _a.answers; track ans.publicUuid; let i = $index) {
                                    <li class="rounded-md border border-surface-muted p-3">
                                      <p class="text-sm font-medium text-content">
                                        <span class="text-content-muted">{{ i + 1 }}.</span>
                                        {{ findQuestion(ans.questionPublicUuid)?.prompt ?? 'Pregunta' }}
                                      </p>
                                      <p class="mt-1 text-sm text-content-muted">
                                        Tu respuesta: <span class="text-content">{{ formatAnswer(ans) }}</span>
                                      </p>
                                      @if (canReveal(_a)) {
                                        <p class="mt-1 text-xs">
                                          <span
                                            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset"
                                            [class]="ans.correct ? 'text-emerald-700 bg-emerald-50 ring-emerald-200' : (ans.correct === false ? 'text-red-700 bg-red-50 ring-red-200' : 'text-slate-600 bg-slate-50 ring-slate-200')"
                                          >
                                            <app-icon [name]="ans.correct ? 'check' : (ans.correct === false ? 'x' : 'help-circle')" [size]="12" />
                                            @if (ans.correct === null) {
                                              Pendiente
                                            } @else if (ans.correct) {
                                              Correcta
                                            }
                                            @if (ans.correct === false) {
                                              Incorrecta
                                            }
                                            · {{ ans.pointsAwarded ?? 0 }} pts
                                          </span>
                                        </p>
                                      }
                                    </li>
                                  }
                                </ol>
                              }

                              @if (canGrade() && _a.status === 'AUTO_GRADED') {
                                <div class="pt-2">
                                  <a [routerLink]="gradeRoute()" class="btn btn-primary btn-sm">
                                    <app-icon name="pencil" [size]="14" />
                                    Calificar short-answers
                                  </a>
                                </div>
                              }
                            </div>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>
      </article>
    }
    }
  `
})
export class QuizResultsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizzes = inject(QuizzesStore);
  private readonly attempts = inject(AttemptsStore);
  private readonly auth = inject(AuthService);

  protected readonly quizPublicUuid = computed<string>(
    () => this.route.snapshot.paramMap.get('uuid') ?? ''
  );

  protected readonly quiz = signal<QuizDetail | null>(null);

  // Store signals aliased for template brevity.
  protected readonly summaries = this.attempts.summaries;
  protected readonly loading = computed(
    () => this.attempts.loadingSummaries() || this.quiz() === null
  );
  protected readonly errorBanner = this.attempts.error;
  protected readonly expandedDetail = this.attempts.current;
  protected readonly loadingDetail = signal<string | null>(null);

  private readonly _expandedRows = signal<Set<string>>(new Set());

  /** True if the caller has LMS_QUIZ_GRADE (TEACHER/ADMIN) — sees all attempts + the grade button. */
  protected readonly canGrade = computed<boolean>(() =>
    this.auth.hasPermission(Permission.LmsQuizGrade)
  );

  protected readonly quizTitle = computed<string | null>(() => this.quiz()?.title ?? null);

  ngOnInit(): void {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      const quiz = await this.quizzes.loadDetail(this.quizPublicUuid());
      this.quiz.set(quiz);
      await this.attempts.loadSummaries(this.quizPublicUuid());
    } catch {
      // Errors land in `attempts.error` / `quizzes.error`. The template handles them.
    }
  }

  // ---------------------------------------------------------------------------
  // Row expand / collapse
  // ---------------------------------------------------------------------------

  protected isExpanded(attemptPublicUuid: string): boolean {
    return this._expandedRows().has(attemptPublicUuid);
  }

  protected async toggleRow(attemptPublicUuid: string): Promise<void> {
    const current = new Set(this._expandedRows());
    if (current.has(attemptPublicUuid)) {
      // Collapse.
      current.delete(attemptPublicUuid);
      this._expandedRows.set(current);
      return;
    }
    // Single-expand semantics: only one row expanded at a time. This keeps
    // `expandedDetail()` (which is the store's current attempt) consistent
    // with what's visible — no per-row map needed.
    current.clear();
    current.add(attemptPublicUuid);
    this._expandedRows.set(current);
    await this.onExpandAttempt(attemptPublicUuid);
  }

  protected async onExpandAttempt(attemptPublicUuid: string): Promise<void> {
    this.loadingDetail.set(attemptPublicUuid);
    try {
      await this.attempts.loadAttempt(attemptPublicUuid);
    } finally {
      this.loadingDetail.set(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------

  protected findQuestion(questionPublicUuid: string): QuestionRow | null {
    return this.quiz()?.questions.find((q) => q.publicUuid === questionPublicUuid) ?? null;
  }

  protected formatAnswer(ans: AnswerRow): string {
    if (ans.selectedOptionId !== null) {
      const q = this.findQuestion(ans.questionPublicUuid);
      const opt = q?.options.find((o) => o.publicUuid === ans.selectedOptionId);
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

  protected shortId(uuid: string): string {
    return uuid.length > 8 ? uuid.slice(0, 8) : uuid;
  }

  protected canReveal(detail: { status: AttemptStatus; revealCorrectness: boolean }): boolean {
    return canRevealCorrectnessFor(detail);
  }

  protected readonly emptyDescription = computed<string>(() => {
    if (this.canGrade()) {
      return 'Ningún estudiante ha tomado este quiz todavía.';
    }
    return 'Todavía no has tomado este quiz. ¡Anímate!';
  });

  protected reload(): void {
    void this.bootstrap();
  }

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  protected quizDetailRoute(): string {
    return ROUTES.LMS.quizDetail(this.quizPublicUuid());
  }

  protected gradeRoute(): string {
    return ROUTES.LMS.quizGrade(this.quizPublicUuid());
  }

  protected takeRoute(): string {
    return ROUTES.LMS.quizTake(this.quizPublicUuid());
  }
}
