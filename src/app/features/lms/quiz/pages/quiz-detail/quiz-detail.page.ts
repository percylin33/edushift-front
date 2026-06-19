import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Permission } from '@core/enums';
import { AuthService } from '@core/services';
import { IconComponent } from '@shared/components';
import { HasPermissionDirective } from '@shared/directives';
import { QuizzesStore } from '../../store/quizzes.store';
import { QuizLifecycleBadgeComponent } from '../../components/quiz-lifecycle-badge/quiz-lifecycle-badge.component';
import { QuestionTypeBadgeComponent } from '../../components/question-type-badge/question-type-badge.component';
import { isQuizCloseable, isQuizEditable, isQuizPublishable } from '../../models/quiz.model';

/**
 * `/lms/quizzes/:uuid` — Quiz detail (FE-7b.1).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Cargar el detail del quiz vía {@link QuizzesStore}.</li>
 *   <li>Mostrar metadata + banco de preguntas en modo preview.</li>
 *   <li>Renderizar {@code isCorrect} / {@code correctText} /
 *       {@code correctBoolean} / {@code expectedKeywords} SOLO si el
 *       caller tiene {@code LMS_QUIZ_GRADE} (el backend ya filtra,
 *       pero el FE también lo respeta para no mostrar campos vacíos
 *       confusamente).</li>
 *   <li>Acciones contextuales: editar (DRAFT), publicar (DRAFT +
 *       questions), cerrar (PUBLISHED), eliminar (DRAFT), tomar
 *       (PUBLISHED + LMS_QUIZ_SUBMIT), ver cola de grading
 *       (PUBLISHED + LMS_QUIZ_GRADE).</li>
 * </ul>
 */
@Component({
  selector: 'app-quiz-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    HasPermissionDirective,
    QuizLifecycleBadgeComponent,
    QuestionTypeBadgeComponent
  ],
  template: `
    @if (loadingDetail()) {
      <div class="card animate-pulse">
        <div class="card-body space-y-2">
          <div class="h-6 w-1/2 rounded bg-surface-muted"></div>
          <div class="h-3 w-1/3 rounded bg-surface-muted"></div>
        </div>
      </div>
    } @else if (quiz()) {
      @let q = quiz()!;
      <header class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-semibold text-content">{{ q.title }}</h1>
            <app-quiz-lifecycle-badge [status]="q.status" />
          </div>
          @if (q.description) {
            <p class="mt-1 text-sm text-content-muted">{{ q.description }}</p>
          }
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <a [routerLink]="backRoute(q.sectionPublicUuid)" class="btn btn-ghost btn-sm">
            <app-icon name="arrow-left" [size]="14" />
            Volver
          </a>
          <ng-container *appHasPermission="permission.LmsQuizCreate">
            @if (canEdit()) {
              <a [routerLink]="editRoute(q.publicUuid)" class="btn btn-ghost btn-sm">
                <app-icon name="edit-2" [size]="14" />
                Editar
              </a>
            }
            @if (canPublish()) {
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="saving()"
                (click)="onPublish()"
              >
                <app-icon name="send" [size]="14" />
                Publicar
              </button>
            }
            @if (canClose()) {
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                [disabled]="saving()"
                (click)="onClose()"
              >
                Cerrar
              </button>
            }
          </ng-container>
          <ng-container *appHasPermission="permission.LmsQuizSubmit">
            @if (q.status === 'PUBLISHED') {
              <a
                [routerLink]="takeRoute(q.publicUuid)"
                class="btn btn-primary btn-sm"
              >
                <app-icon name="play" [size]="14" />
                Tomar quiz
              </a>
            }
          </ng-container>
          <ng-container *appHasPermission="permission.LmsQuizGrade">
            @if (q.status === 'PUBLISHED' || q.status === 'CLOSED') {
              <a
                [routerLink]="gradeRoute(q.publicUuid)"
                class="btn btn-ghost btn-sm"
              >
                <app-icon name="clipboard-check" [size]="14" />
                Cola de grading
              </a>
            }
          </ng-container>
        </div>
      </header>

      <!-- Metadata grid -->
      <section class="card mb-4">
        <div class="card-body">
          <h2 class="card-title text-base">Información</h2>
          <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt class="text-xs text-content-muted">Vence</dt>
              <dd class="font-medium">{{ q.dueAt ? (q.dueAt | date: 'medium') : '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">Puntaje máx.</dt>
              <dd class="font-medium">{{ q.maxScore }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">Intentos</dt>
              <dd class="font-medium">{{ q.maxAttempts }}</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">Tiempo límite</dt>
              <dd class="font-medium">
                {{ q.timeLimitMinutes ? q.timeLimitMinutes + ' min' : 'Sin límite' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">Preguntas</dt>
              <dd class="font-medium">{{ q.questionCount }} ({{ q.totalPoints }} pts)</dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">Publicado</dt>
              <dd class="font-medium">
                {{ q.publishedAt ? (q.publishedAt | date: 'short') : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">Cerrado</dt>
              <dd class="font-medium">
                {{ q.closedAt ? (q.closedAt | date: 'short') : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-content-muted">Creado</dt>
              <dd class="font-medium">{{ q.createdAt | date: 'short' }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- Banco de preguntas -->
      <section class="card">
        <div class="card-body space-y-4">
          <h2 class="card-title text-base">Banco de preguntas</h2>

          @if (q.questions.length === 0) {
            <p class="text-sm text-content-muted">
              Este quiz aún no tiene preguntas.
              @if (canEdit()) {
                <a [routerLink]="editRoute(q.publicUuid)" class="link link-primary">
                  Añade la primera pregunta
                </a>
              }
            </p>
          } @else {
            <ol class="space-y-4">
              @for (question of q.questions; track question.publicUuid; let i = $index) {
                <li class="rounded-lg border border-base-200 p-4">
                  <header class="mb-2 flex items-center gap-2">
                    <span class="text-sm font-semibold text-content-muted">
                      {{ i + 1 }}.
                    </span>
                    <app-question-type-badge [type]="question.type" />
                    <span class="text-xs text-content-muted">
                      {{ question.points }} pts
                    </span>
                  </header>

                  <p class="text-sm text-content">{{ question.prompt }}</p>

                  @if (question.type === 'MC') {
                    <ul class="mt-3 space-y-1.5 text-sm">
                      @for (opt of question.options; track opt.publicUuid) {
                        <li class="flex items-center gap-2">
                          <span
                            class="inline-block h-2 w-2 rounded-full"
                            [class.bg-emerald-500]="opt.isCorrect === true"
                            [class.bg-zinc-300]="opt.isCorrect !== true"
                          ></span>
                          <span>{{ opt.label }}</span>
                          @if (canRevealCorrectness() && opt.isCorrect === true) {
                            <span class="badge badge-success badge-sm">Correcta</span>
                          }
                          @if (canRevealCorrectness() && opt.explanation) {
                            <span class="text-xs text-content-muted">— {{ opt.explanation }}</span>
                          }
                        </li>
                      }
                    </ul>
                  } @else if (question.type === 'TF') {
                    @if (canRevealCorrectness()) {
                      <p class="mt-2 text-sm">
                        <span class="text-content-muted">Respuesta correcta:</span>
                        <span class="ml-1 font-medium">
                          {{ question.correctBoolean ? 'Verdadero' : 'Falso' }}
                        </span>
                      </p>
                    } @else {
                      <p class="mt-2 text-sm text-content-muted">
                        Pregunta de verdadero / falso. Se califica con
                        retroalimentación al enviar.
                      </p>
                    }
                  } @else if (question.type === 'SHORT_ANSWER') {
                    @if (canRevealCorrectness()) {
                      <p class="mt-2 text-sm">
                        <span class="text-content-muted">Keywords esperadas:</span>
                        <span class="ml-1 font-medium">
                          {{ question.expectedKeywords || '(cualquier respuesta es válida)' }}
                        </span>
                      </p>
                      @if (question.correctText) {
                        <p class="mt-1 text-sm">
                          <span class="text-content-muted">Respuesta modelo:</span>
                          <span class="ml-1 font-medium">{{ question.correctText }}</span>
                        </p>
                      }
                    } @else {
                      <p class="mt-2 text-sm text-content-muted">
                        Pregunta de respuesta corta. El docente revisará
                        manualmente (calificación tras submit).
                      </p>
                    }
                  }
                </li>
              }
            </ol>
          }
        </div>
      </section>
    } @else if (errorBanner()) {
      <div class="alert alert-danger" role="alert">
        <app-icon name="alert-circle" [size]="18" />
        <div class="flex-1">
          <p class="font-medium">No pudimos cargar el quiz.</p>
          <p class="text-xs opacity-80">{{ errorBanner() }}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
          <app-icon name="refresh" [size]="14" />
          Reintentar
        </button>
      </div>
    }
  `
})
export class QuizDetailPage implements OnInit {
  private readonly store = inject(QuizzesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly quiz = this.store.selected;
  protected readonly loadingDetail = this.store.loadingDetail;
  protected readonly errorBanner = this.store.error;
  protected readonly saving = this.store.saving;
  protected readonly permission = Permission;

  #quizUuid: string | null = null;

  ngOnInit(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (!uuid) {
      void this.router.navigate([ROUTES.DASHBOARD.ROOT]);
      return;
    }
    this.#quizUuid = uuid;
    void this.store.loadDetail(uuid);
  }

  protected reload(): void {
    if (!this.#quizUuid) return;
    this.store.clearError();
    void this.store.loadDetail(this.#quizUuid);
  }

  protected canEdit(): boolean {
    const q = this.quiz();
    return !!q && isQuizEditable(q);
  }

  protected canPublish(): boolean {
    const q = this.quiz();
    return !!q && isQuizPublishable(q);
  }

  protected canClose(): boolean {
    const q = this.quiz();
    return !!q && isQuizCloseable(q);
  }

  protected canRevealCorrectness(): boolean {
    const q = this.quiz();
    if (!q) return false;
    // El backend ya filtra `isCorrect`/`expectedKeywords` para takers,
    // pero el FE muestra la respuesta modelo solo si el caller es grader.
    if (q.revealCorrectness) return true;
    return this.auth.hasPermission(Permission.LmsQuizGrade);
  }

  protected backRoute(sectionUuid: string): string {
    return ROUTES.LMS.sectionQuizzes(sectionUuid);
  }

  protected editRoute(uuid: string): string {
    return ROUTES.LMS.quizEdit(uuid);
  }

  protected takeRoute(uuid: string): string {
    return ROUTES.LMS.quizTake(uuid);
  }

  protected gradeRoute(uuid: string): string {
    return ROUTES.LMS.quizGrade(uuid);
  }

  protected async onPublish(): Promise<void> {
    if (!this.#quizUuid) return;
    await this.store.publishQuiz(this.#quizUuid);
  }

  protected async onClose(): Promise<void> {
    if (!this.#quizUuid) return;
    await this.store.closeQuiz(this.#quizUuid);
  }
}
