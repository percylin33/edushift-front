import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Permission } from '@core/enums';
import { EmptyStateComponent, IconComponent } from '@shared/components';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { QuizzesStore } from '../../store/quizzes.store';
import {
  CreateQuestionRequest,
  QuestionRow,
  QuestionType,
  QuizDetail,
  isQuizEditable,
} from '../../models/quiz.model';
import { QuestionTypeBadgeComponent } from '../../components/question-type-badge/question-type-badge.component';
import { AiAssistantPanelComponent } from '../../components/ai-assistant-panel/ai-assistant-panel.component';
import { CreateAiQuestionRequest } from '../../models/ai-assistant.model';

type WizardStep = 1 | 2 | 3;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Datos',
  2: 'Preguntas',
  3: 'Publicar',
};

const META_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  dueAt: 'Fecha de vencimiento',
  timeLimitMinutes: 'Tiempo límite',
  maxAttempts: 'Intentos permitidos',
  maxScore: 'Puntaje máximo',
};

/**
 * `/lms/quizzes/new` y `/lms/quizzes/:uuid/edit` — builder de práctica
 * con wizard de 3 pasos y validación que bloquea el avance.
 *
 * <ol>
 *   <li><b>Datos</b> — metadata; Continuar crea/actualiza el borrador.</li>
 *   <li><b>Preguntas</b> — banco + IA; Siguiente exige ≥1 pregunta.</li>
 *   <li><b>Revisar</b> — resumen + Publicar.</li>
 * </ol>
 */
@Component({
  selector: 'app-quiz-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    QuestionTypeBadgeComponent,
    HasPermissionDirective,
    AiAssistantPanelComponent,
  ],
  template: `
    <header class="mb-4 flex items-center justify-between gap-2">
      <div>
        <h1 class="text-2xl font-semibold text-content">
          {{ isEdit() ? 'Editar práctica' : 'Nueva práctica' }}
        </h1>
        <p class="text-sm text-content-muted">
          Completa cada paso. El sistema no avanza si falta algún dato obligatorio.
        </p>
      </div>
      <a [routerLink]="cancelRoute()" class="btn btn-ghost btn-sm">
        <app-icon name="arrow-left" [size]="14" />
        Volver
      </a>
    </header>

    @if (loadingDetail()) {
      <div class="card animate-pulse">
        <div class="card-body space-y-2">
          <div class="h-4 w-1/2 rounded bg-surface-muted"></div>
          <div class="h-3 w-1/3 rounded bg-surface-muted"></div>
        </div>
      </div>
    } @else if (isEdit() && selected() && !editable()) {
      <div class="alert alert-warning" role="alert">
        <app-icon name="alert-triangle" [size]="18" />
        <div>
          <p class="font-medium">Esta práctica no se puede editar.</p>
          <p class="text-xs opacity-80">Solo se pueden editar prácticas en estado DRAFT.</p>
        </div>
      </div>
    } @else {
      <!-- Step indicator -->
      <nav class="mb-6" aria-label="Pasos de la práctica" data-testid="quiz-stepper">
        <ol class="flex flex-wrap items-center gap-2 sm:gap-0">
          @for (s of steps; track s) {
            <li class="flex items-center">
              <button
                type="button"
                class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                [class.bg-primary-50]="currentStep() === s"
                [class.text-primary-700]="currentStep() === s"
                [class.font-semibold]="currentStep() === s"
                [class.text-content-muted]="currentStep() !== s && !isStepUnlocked(s)"
                [class.text-content]="currentStep() !== s && isStepUnlocked(s)"
                [disabled]="!isStepUnlocked(s)"
                [attr.aria-current]="currentStep() === s ? 'step' : null"
                (click)="goToStep(s)"
                [attr.data-testid]="'step-tab-' + s"
              >
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                  [class.bg-primary-600]="currentStep() === s || isStepCompleted(s)"
                  [class.text-white]="currentStep() === s || isStepCompleted(s)"
                  [class.bg-surface-muted]="currentStep() !== s && !isStepCompleted(s)"
                >
                  @if (isStepCompleted(s) && currentStep() !== s) {
                    <app-icon name="check" [size]="14" />
                  } @else {
                    {{ s }}
                  }
                </span>
                <span class="hidden sm:inline">{{ stepLabel(s) }}</span>
              </button>
              @if (s < 3) {
                <span class="mx-1 hidden text-content-subtle sm:inline" aria-hidden="true">→</span>
              }
            </li>
          }
        </ol>
      </nav>

      @if (stepError(); as err) {
        <div class="alert alert-danger mb-4" role="alert" data-testid="step-error">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1 text-sm">
            <p class="font-medium">No puedes continuar todavía</p>
            <ul class="mt-1 list-inside list-disc text-xs opacity-90">
              @for (line of err; track line) {
                <li>{{ line }}</li>
              }
            </ul>
          </div>
        </div>
      }

      <!-- Step 1: Datos -->
      @if (currentStep() === 1) {
        <section class="card mb-24" data-testid="step-panel-1">
          <div class="card-body space-y-4">
            <h2 class="card-title text-base">Datos básicos</h2>
            <form [formGroup]="metadataForm" id="quiz-meta-form" (ngSubmit)="onContinueFromDatos()">
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="form-control sm:col-span-2">
                  <span class="label-text">Título *</span>
                  <input
                    id="meta-title"
                    type="text"
                    class="input"
                    formControlName="title"
                    maxlength="200"
                    placeholder="p. ej. Práctica: Fracciones — 5to grado"
                    [class.ring-2]="!!metaErrorMessage('title')"
                    [class.ring-red-500]="!!metaErrorMessage('title')"
                  />
                  @if (metaErrorMessage('title'); as msg) {
                    <span class="text-error text-xs">{{ msg }}</span>
                  }
                </label>

                <label class="form-control sm:col-span-2">
                  <span class="label-text">Descripción (opcional)</span>
                  <textarea
                    class="textarea"
                    rows="3"
                    formControlName="description"
                    maxlength="10000"
                  ></textarea>
                </label>

                <label class="form-control">
                  <span class="label-text">Vence</span>
                  <input type="datetime-local" class="input" formControlName="dueAt" />
                </label>

                <label class="form-control">
                  <span class="label-text">Tiempo límite (min, opcional)</span>
                  <input
                    id="meta-timeLimitMinutes"
                    type="number"
                    class="input"
                    formControlName="timeLimitMinutes"
                    min="1"
                    max="480"
                    [class.ring-2]="!!metaErrorMessage('timeLimitMinutes')"
                    [class.ring-red-500]="!!metaErrorMessage('timeLimitMinutes')"
                  />
                  @if (metaErrorMessage('timeLimitMinutes'); as msg) {
                    <span class="text-error text-xs">{{ msg }}</span>
                  }
                </label>

                <label class="form-control">
                  <span class="label-text">Intentos permitidos *</span>
                  <input
                    id="meta-maxAttempts"
                    type="number"
                    class="input"
                    formControlName="maxAttempts"
                    min="1"
                    max="10"
                    [class.ring-2]="!!metaErrorMessage('maxAttempts')"
                    [class.ring-red-500]="!!metaErrorMessage('maxAttempts')"
                  />
                  @if (metaErrorMessage('maxAttempts'); as msg) {
                    <span class="text-error text-xs">{{ msg }}</span>
                  }
                </label>

                <label class="form-control">
                  <span class="label-text">Puntaje máximo *</span>
                  <input
                    id="meta-maxScore"
                    type="number"
                    class="input"
                    formControlName="maxScore"
                    min="0"
                    max="1000"
                    [class.ring-2]="!!metaErrorMessage('maxScore')"
                    [class.ring-red-500]="!!metaErrorMessage('maxScore')"
                  />
                  @if (metaErrorMessage('maxScore'); as msg) {
                    <span class="text-error text-xs">{{ msg }}</span>
                  }
                </label>
              </div>
            </form>
          </div>
        </section>
      }

      <!-- Step 2: Preguntas -->
      @if (currentStep() === 2) {
        <section class="card mb-24" data-testid="step-panel-2">
          <div class="card-body space-y-4">
            <header class="flex items-center justify-between">
              <h2 class="card-title text-base">Banco de preguntas</h2>
              @if (selected(); as quiz) {
                <span class="text-xs text-content-muted">
                  {{ quiz.questions.length }} pregunta(s) · {{ totalPoints() }} pts
                </span>
              }
            </header>

            @if (selected(); as quiz) {
              @if (quiz.questions.length === 0) {
                <div id="questions-empty">
                  <app-empty-state
                    title="Aún no hay preguntas"
                    description="Añade al menos una pregunta para pasar al siguiente paso."
                    [icon]="'help-circle'"
                  />
                </div>
              } @else {
                <ol class="space-y-3">
                  @for (q of quiz.questions; track q.publicUuid; let i = $index) {
                    <li class="border-base-200 rounded-lg border p-3">
                      <div class="mb-2 flex items-center gap-2">
                        <span class="text-sm font-semibold text-content-muted">{{ i + 1 }}.</span>
                        <app-question-type-badge [type]="q.type" />
                        <span class="text-xs text-content-muted">{{ q.points }} pts</span>
                      </div>
                      <p class="text-sm text-content">{{ q.prompt }}</p>
                      @if (q.type === 'MC') {
                        <ul class="mt-2 space-y-1 text-sm">
                          @for (opt of q.options; track opt.publicUuid) {
                            <li class="flex items-center gap-2">
                              <span
                                class="inline-block h-2 w-2 rounded-full"
                                [class.bg-emerald-500]="opt.isCorrect === true"
                                [class.bg-zinc-300]="opt.isCorrect !== true"
                              ></span>
                              {{ opt.label }}
                              @if (opt.isCorrect === true) {
                                <span class="text-xs text-emerald-700">(correcta)</span>
                              }
                            </li>
                          }
                        </ul>
                      } @else if (q.type === 'TF') {
                        <p class="mt-2 text-sm">
                          <span class="text-content-muted">Respuesta correcta:</span>
                          <span class="ml-1 font-medium">
                            {{ q.correctBoolean ? 'Verdadero' : 'Falso' }}
                          </span>
                        </p>
                      } @else if (q.type === 'SHORT_ANSWER') {
                        <p class="mt-2 text-sm">
                          <span class="text-content-muted">Keywords esperadas:</span>
                          <span class="ml-1 font-medium">{{ q.expectedKeywords || '—' }}</span>
                        </p>
                      }
                    </li>
                  }
                </ol>
              }

              <details class="border-base-200 rounded-lg border p-3" open>
                <summary class="cursor-pointer text-sm font-medium text-content">
                  <app-icon name="plus" [size]="14" />
                  Añadir pregunta
                </summary>
                <div class="card-actions justify-end pt-2">
                  <button
                    *appHasPermission="Permission.LmsAiGenerate"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    (click)="toggleAiPanel()"
                    data-testid="ai-toggle"
                  >
                    <app-icon name="sparkles" [size]="14" />
                    {{ aiPanelOpen() ? 'Ocultar asistente IA' : 'Sugerir con IA' }}
                  </button>
                </div>
                @if (aiPanelOpen()) {
                  <div class="mt-3" data-testid="ai-panel-slot">
                    <app-ai-assistant-panel (accept)="onAiAccepted($event)" />
                  </div>
                }
                <form
                  [formGroup]="questionForm"
                  (ngSubmit)="onAddQuestion()"
                  class="mt-3 space-y-3"
                  id="quiz-question-form"
                >
                  <div class="grid gap-3 sm:grid-cols-12">
                    <label class="form-control sm:col-span-4">
                      <span class="label-text">Tipo</span>
                      <select class="select" formControlName="type">
                        <option [ngValue]="type.MultipleChoice">Opción múltiple</option>
                        <option [ngValue]="type.TrueFalse">Verdadero / Falso</option>
                        <option [ngValue]="type.ShortAnswer">Respuesta corta</option>
                      </select>
                    </label>
                    <label class="form-control sm:col-span-6">
                      <span class="label-text">Puntos</span>
                      <input
                        type="number"
                        class="input"
                        formControlName="points"
                        min="1"
                        max="100"
                      />
                    </label>
                  </div>

                  <label class="form-control">
                    <span class="label-text">Pregunta (prompt) *</span>
                    <textarea
                      id="q-prompt"
                      class="textarea"
                      rows="2"
                      formControlName="prompt"
                      maxlength="2000"
                      [class.ring-2]="!!questionErrorMessage('prompt')"
                      [class.ring-red-500]="!!questionErrorMessage('prompt')"
                    ></textarea>
                    @if (questionErrorMessage('prompt'); as msg) {
                      <span class="text-error text-xs">{{ msg }}</span>
                    }
                  </label>

                  @if (questionForm.value.type === 'MC') {
                    <div formArrayName="options">
                      @for (opt of optionsArray.controls; track $index; let i = $index) {
                        <div [formGroupName]="i" class="mb-2 flex items-center gap-2">
                          <input
                            type="radio"
                            class="radio"
                            formControlName="isCorrect"
                            [value]="true"
                            [attr.aria-label]="'Marcar opción ' + (i + 1) + ' como correcta'"
                          />
                          <input
                            type="text"
                            class="input flex-1"
                            formControlName="label"
                            [attr.placeholder]="'Opción ' + (i + 1)"
                            maxlength="500"
                          />
                          @if (optionsArray.length > 2) {
                            <button
                              type="button"
                              class="btn btn-ghost btn-xs"
                              (click)="removeOption(i)"
                            >
                              <app-icon name="trash" [size]="12" />
                            </button>
                          }
                        </div>
                      }
                      @if (optionsArray.length < 6) {
                        <button type="button" class="btn btn-ghost btn-xs" (click)="addOption()">
                          <app-icon name="plus" [size]="12" />
                          Añadir opción
                        </button>
                      }
                    </div>
                  } @else if (questionForm.value.type === 'TF') {
                    <div class="form-control">
                      <span class="label-text">Respuesta correcta</span>
                      <div class="flex gap-4">
                        <label class="flex items-center gap-2">
                          <input
                            type="radio"
                            class="radio"
                            formControlName="correctBoolean"
                            [value]="true"
                          />
                          Verdadero
                        </label>
                        <label class="flex items-center gap-2">
                          <input
                            type="radio"
                            class="radio"
                            formControlName="correctBoolean"
                            [value]="false"
                          />
                          Falso
                        </label>
                      </div>
                    </div>
                  } @else if (questionForm.value.type === 'SHORT_ANSWER') {
                    <label class="form-control">
                      <span class="label-text">Keywords esperadas (CSV)</span>
                      <input
                        type="text"
                        class="input"
                        formControlName="expectedKeywords"
                        placeholder="p. ej. mamífero,cordado,vertebrado"
                        maxlength="1000"
                      />
                    </label>
                  }

                  <div class="card-actions justify-end">
                    <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving()">
                      <app-icon name="plus" [size]="14" />
                      Añadir pregunta
                    </button>
                  </div>
                </form>
              </details>
            } @else {
              <div class="alert alert-warning">
                <app-icon name="alert-triangle" [size]="16" />
                <p class="text-sm">Primero guarda los datos básicos para poder añadir preguntas.</p>
              </div>
            }
          </div>
        </section>
      }

      <!-- Step 3: Revisar -->
      @if (currentStep() === 3) {
        <section class="card mb-24" data-testid="step-panel-3">
          <div class="card-body space-y-4">
            <h2 class="card-title text-base">Revisar y publicar</h2>
            @if (selected(); as quiz) {
              <dl class="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt class="text-xs text-content-muted">Título</dt>
                  <dd class="font-medium">{{ quiz.title }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-content-muted">Preguntas</dt>
                  <dd class="font-medium">
                    {{ quiz.questions.length }} · {{ totalPoints() }} pts
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-content-muted">Vence</dt>
                  <dd class="font-medium">
                    {{ quiz.dueAt ? (quiz.dueAt | date: 'medium') : 'Sin fecha' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-content-muted">Intentos / puntaje máx.</dt>
                  <dd class="font-medium">{{ quiz.maxAttempts }} · {{ quiz.maxScore }}</dd>
                </div>
                @if (quiz.description) {
                  <div class="sm:col-span-2">
                    <dt class="text-xs text-content-muted">Descripción</dt>
                    <dd class="mt-1 whitespace-pre-wrap">{{ quiz.description }}</dd>
                  </div>
                }
              </dl>
              <ol class="space-y-2 border-t border-border-subtle pt-3">
                @for (q of quiz.questions; track q.publicUuid; let i = $index) {
                  <li class="text-sm">
                    <span class="text-content-muted">{{ i + 1 }}.</span>
                    {{ q.prompt }}
                    <span class="text-xs text-content-muted">({{ q.points }} pts)</span>
                  </li>
                }
              </ol>
            }
          </div>
        </section>
      }

      <!-- Sticky footer -->
      <footer
        class="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-surface/95 px-4 py-3 backdrop-blur"
        data-testid="quiz-wizard-footer"
      >
        <div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="currentStep() === 1 || saving()"
            (click)="goBack()"
            data-testid="wizard-back"
          >
            <app-icon name="arrow-left" [size]="14" />
            Atrás
          </button>

          <div class="flex flex-wrap items-center gap-2">
            @if (currentStep() === 1) {
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="saving()"
                (click)="onContinueFromDatos()"
                data-testid="wizard-continue"
              >
                Continuar
                <app-icon name="arrow-right" [size]="14" />
              </button>
            } @else if (currentStep() === 2) {
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="saving()"
                (click)="onContinueFromPreguntas()"
                data-testid="wizard-next"
              >
                Siguiente
                <app-icon name="arrow-right" [size]="14" />
              </button>
            } @else {
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                [disabled]="saving()"
                (click)="goToStep(1)"
              >
                Editar datos
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="saving()"
                (click)="onPublish()"
                data-testid="wizard-publish"
              >
                <app-icon name="send" [size]="14" />
                Publicar práctica
              </button>
            }
          </div>
        </div>
      </footer>
    }

    @if (errorBanner()) {
      <div class="alert alert-danger mt-4 mb-24" role="alert">
        <app-icon name="alert-circle" [size]="18" />
        <p>{{ errorBanner() }}</p>
      </div>
    }
  `,
})
export class QuizFormPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(QuizzesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly type = QuestionType;
  protected readonly steps: WizardStep[] = [1, 2, 3];
  protected readonly selected = this.store.selected;
  protected readonly loadingDetail = this.store.loadingDetail;
  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;

  protected readonly isEdit = signal<boolean>(false);
  protected readonly currentStep = signal<WizardStep>(1);
  protected readonly stepError = signal<string[] | null>(null);
  protected readonly aiPanelOpen = signal<boolean>(false);
  protected readonly Permission = Permission;

  protected readonly editable = computed(() => {
    const sel = this.selected();
    return sel ? isQuizEditable(sel) : true;
  });

  protected readonly totalPoints = computed(() => {
    const sel = this.selected();
    if (!sel) return 0;
    return sel.questions.reduce((acc, q) => acc + q.points, 0);
  });

  protected readonly metadataForm: FormGroup<{
    title: FormControl<string | null>;
    description: FormControl<string | null>;
    dueAt: FormControl<string | null>;
    timeLimitMinutes: FormControl<number | null>;
    maxAttempts: FormControl<number | null>;
    maxScore: FormControl<number | null>;
  }> = this.fb.group({
    title: this.fb.control<string | null>(null, {
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: this.fb.control<string | null>(null, {
      validators: [Validators.maxLength(10000)],
    }),
    dueAt: this.fb.control<string | null>(null),
    timeLimitMinutes: this.fb.control<number | null>(null, {
      validators: [Validators.min(1), Validators.max(480)],
    }),
    maxAttempts: this.fb.control<number | null>(1, {
      validators: [Validators.required, Validators.min(1), Validators.max(10)],
    }),
    maxScore: this.fb.control<number | null>(100, {
      validators: [Validators.required, Validators.min(0), Validators.max(1000)],
    }),
  });

  protected readonly questionForm: FormGroup<{
    type: FormControl<QuestionType>;
    prompt: FormControl<string | null>;
    points: FormControl<number | null>;
    correctBoolean: FormControl<boolean | null>;
    expectedKeywords: FormControl<string | null>;
    options: FormArray<
      FormGroup<{
        label: FormControl<string | null>;
        isCorrect: FormControl<boolean>;
      }>
    >;
  }> = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<QuestionType>(QuestionType.MultipleChoice, {
      validators: [Validators.required],
    }),
    prompt: this.fb.control<string | null>(null, {
      validators: [Validators.required, Validators.maxLength(2000)],
    }),
    points: this.fb.control<number | null>(5, {
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
    correctBoolean: this.fb.control<boolean | null>(true),
    expectedKeywords: this.fb.control<string | null>(null),
    options: this.fb.array<
      FormGroup<{
        label: FormControl<string | null>;
        isCorrect: FormControl<boolean>;
      }>
    >(this.makeDefaultOptions()),
  });

  #sectionUuid: string | null = null;
  #assignmentUuid: string | null = null;
  #quizUuid: string | null = null;

  ngOnInit(): void {
    const sectionUuid = this.route.snapshot.queryParamMap.get('section');
    const assignmentUuid = this.route.snapshot.queryParamMap.get('assignment');
    const quizUuid = this.route.snapshot.paramMap.get('uuid');
    this.#sectionUuid = sectionUuid;
    this.#assignmentUuid = assignmentUuid;
    this.#quizUuid = quizUuid;

    if (quizUuid) {
      this.isEdit.set(true);
      void this.store.loadDetail(quizUuid).then((detail) => {
        if (detail) {
          this.populateFromDetail(detail);
          // En edición, si ya hay preguntas, abrir en paso 2; si no, paso 1.
          this.currentStep.set(detail.questions.length > 0 ? 2 : 1);
        }
      });
    } else if (!sectionUuid || !assignmentUuid) {
      void this.router.navigate([ROUTES.DASHBOARD.ROOT]);
    }
  }

  protected get optionsArray(): FormArray<
    FormGroup<{
      label: FormControl<string | null>;
      isCorrect: FormControl<boolean>;
    }>
  > {
    return this.questionForm.controls.options;
  }

  protected stepLabel(s: WizardStep): string {
    return STEP_LABELS[s];
  }

  protected isStepUnlocked(s: WizardStep): boolean {
    if (s === 1) return true;
    if (s === 2) return !!this.#quizUuid || !!this.selected();
    // Paso 3: borrador + al menos una pregunta
    const q = this.selected();
    return !!q && q.questions.length >= 1;
  }

  protected isStepCompleted(s: WizardStep): boolean {
    if (s === 1) return !!this.#quizUuid || !!this.selected();
    if (s === 2) {
      const q = this.selected();
      return !!q && q.questions.length >= 1;
    }
    return false;
  }

  protected goToStep(s: WizardStep): void {
    if (!this.isStepUnlocked(s)) return;
    this.stepError.set(null);
    this.currentStep.set(s);
  }

  protected goBack(): void {
    const s = this.currentStep();
    if (s <= 1) return;
    this.stepError.set(null);
    this.currentStep.set((s - 1) as WizardStep);
  }

  // -------------------------------------------------------------------------
  // Step gates
  // -------------------------------------------------------------------------

  protected async onContinueFromDatos(): Promise<void> {
    this.stepError.set(null);
    if (this.metadataForm.invalid) {
      this.metadataForm.markAllAsTouched();
      this.stepError.set(this.collectMetadataIssues());
      this.focusFirstInvalidMeta();
      return;
    }

    const ok = await this.persistMetadata();
    if (!ok) return;

    this.stepError.set(null);
    this.currentStep.set(2);
  }

  protected onContinueFromPreguntas(): void {
    this.stepError.set(null);
    const quiz = this.selected();
    if (!quiz || quiz.questions.length < 1) {
      this.stepError.set(['Añade al menos una pregunta antes de continuar.']);
      document.getElementById('questions-empty')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.currentStep.set(3);
  }

  protected async onAddQuestion(): Promise<void> {
    if (!this.#quizUuid) return;
    this.stepError.set(null);
    if (this.questionForm.invalid) {
      this.questionForm.markAllAsTouched();
      this.stepError.set(this.collectQuestionIssues());
      this.focusElement('q-prompt');
      return;
    }
    const raw = this.questionForm.value;
    const request: CreateQuestionRequest = {
      type: raw.type as QuestionType,
      prompt: raw.prompt ?? '',
      points: raw.points ?? 5,
      correctBoolean: raw.type === QuestionType.TrueFalse ? raw.correctBoolean : undefined,
      expectedKeywords:
        raw.type === QuestionType.ShortAnswer ? (raw.expectedKeywords ?? null) : undefined,
      options:
        raw.type === QuestionType.MultipleChoice
          ? (raw.options ?? [])
              .filter((o) => (o?.label ?? '').trim().length > 0)
              .map((o) => ({
                label: o!.label as string,
                isCorrect: !!o!.isCorrect,
                explanation: null,
              }))
          : undefined,
    };
    const added = await this.store.addQuestion(this.#quizUuid, request);
    if (added) {
      this.resetQuestionForm();
      this.stepError.set(null);
    }
  }

  protected async onPublish(): Promise<void> {
    if (!this.#quizUuid) return;
    const quiz = this.selected();
    if (!quiz || quiz.questions.length < 1) {
      this.stepError.set(['Añade al menos una pregunta antes de publicar.']);
      this.currentStep.set(2);
      return;
    }
    const published = await this.store.publishQuiz(this.#quizUuid);
    if (published) {
      void this.router.navigate([ROUTES.LMS.quizDetail(published.publicUuid)]);
    }
  }

  protected toggleAiPanel(): void {
    this.aiPanelOpen.update((v) => !v);
  }

  protected async onAiAccepted(req: CreateAiQuestionRequest): Promise<void> {
    if (!this.#quizUuid) return;
    const createRequest: CreateQuestionRequest = aiToCreateQuestionRequest(req);
    const added = await this.store.addQuestion(this.#quizUuid, createRequest);
    if (added) {
      this.questionForm.patchValue({ type: added.type });
      this.resetQuestionForm({ keepType: added.type });
      this.stepError.set(null);
    }
  }

  protected cancelRoute(): string {
    if (this.#sectionUuid) {
      return ROUTES.LMS.sectionQuizzes(this.#sectionUuid);
    }
    if (this.#quizUuid) {
      return ROUTES.LMS.quizDetail(this.#quizUuid);
    }
    return ROUTES.LMS.ROOT;
  }

  // -------------------------------------------------------------------------
  // Validation messages
  // -------------------------------------------------------------------------

  protected metaErrorMessage(name: keyof typeof this.metadataForm.controls): string | null {
    const c = this.metadataForm.controls[name];
    if (!c || !(c.touched || c.dirty) || !c.errors) return null;
    return this.describeControlError(name, c);
  }

  protected questionErrorMessage(name: keyof typeof this.questionForm.controls): string | null {
    const c = this.questionForm.controls[name];
    if (!c || !(c.touched || c.dirty) || c instanceof FormArray) return null;
    if (!c.errors) return null;
    if (c.errors['required']) return 'El enunciado es obligatorio.';
    if (c.errors['maxlength']) return 'Máximo 2000 caracteres.';
    if (c.errors['min'] || c.errors['max']) return 'Puntos fuera de rango (1–100).';
    return 'Valor inválido.';
  }

  private collectMetadataIssues(): string[] {
    const issues: string[] = [];
    for (const key of Object.keys(this.metadataForm.controls) as Array<
      keyof typeof this.metadataForm.controls
    >) {
      const c = this.metadataForm.controls[key];
      if (c.invalid) {
        const msg = this.describeControlError(key, c);
        if (msg) issues.push(`${META_FIELD_LABELS[key] ?? key}: ${msg}`);
      }
    }
    return issues.length > 0 ? issues : ['Revisa los campos marcados.'];
  }

  private collectQuestionIssues(): string[] {
    const issues: string[] = [];
    if (this.questionForm.controls.prompt.invalid) {
      issues.push('Falta el enunciado de la pregunta.');
    }
    if (this.questionForm.controls.points.invalid) {
      issues.push('Los puntos deben estar entre 1 y 100.');
    }
    if (this.questionForm.value.type === QuestionType.MultipleChoice) {
      const labels = (this.questionForm.value.options ?? []).filter(
        (o) => (o?.label ?? '').trim().length > 0,
      );
      if (labels.length < 2) {
        issues.push('Añade al menos 2 opciones con texto.');
      }
      const hasCorrect = (this.questionForm.value.options ?? []).some((o) => !!o?.isCorrect);
      if (!hasCorrect) {
        issues.push('Marca la opción correcta.');
      }
    }
    return issues.length > 0 ? issues : ['Revisa el formulario de la pregunta.'];
  }

  private describeControlError(name: string, c: AbstractControl): string {
    const e = c.errors;
    if (!e) return 'Valor inválido.';
    if (e['required']) return 'Campo obligatorio.';
    if (e['maxlength']) {
      return `Máximo ${e['maxlength'].requiredLength} caracteres.`;
    }
    if (e['min'] || e['max']) {
      if (name === 'maxAttempts') return 'Debe ser entre 1 y 10.';
      if (name === 'maxScore') return 'Debe ser entre 0 y 1000.';
      if (name === 'timeLimitMinutes') return 'Debe ser entre 1 y 480.';
      return 'Fuera de rango.';
    }
    return 'Valor inválido.';
  }

  private focusFirstInvalidMeta(): void {
    const order: Array<keyof typeof this.metadataForm.controls> = [
      'title',
      'maxAttempts',
      'maxScore',
      'timeLimitMinutes',
    ];
    for (const key of order) {
      if (this.metadataForm.controls[key].invalid) {
        this.focusElement(`meta-${key}`);
        return;
      }
    }
  }

  private focusElement(id: string): void {
    queueMicrotask(() => {
      const el = document.getElementById(id) as HTMLElement | null;
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // -------------------------------------------------------------------------
  // Persist
  // -------------------------------------------------------------------------

  private async persistMetadata(): Promise<boolean> {
    const raw = this.metadataForm.value;
    if (this.isEdit() && this.#quizUuid) {
      const updated = await this.store.updateQuiz(this.#quizUuid, {
        title: raw.title ?? undefined,
        description: raw.description ?? null,
        dueAt: raw.dueAt ? new Date(raw.dueAt).toISOString() : null,
        timeLimitMinutes: raw.timeLimitMinutes ?? null,
        maxAttempts: raw.maxAttempts ?? undefined,
        maxScore: raw.maxScore ?? undefined,
      });
      if (updated) {
        this.populateFromDetail(updated);
        return true;
      }
      return false;
    }

    if (this.#sectionUuid && this.#assignmentUuid) {
      const created = await this.store.createQuiz(this.#sectionUuid, {
        title: raw.title ?? '',
        description: raw.description ?? null,
        dueAt: raw.dueAt ? new Date(raw.dueAt).toISOString() : null,
        timeLimitMinutes: raw.timeLimitMinutes ?? null,
        maxAttempts: raw.maxAttempts ?? 1,
        maxScore: raw.maxScore ?? 100,
        teacherAssignmentPublicUuid: this.#assignmentUuid,
      });
      if (created) {
        this.#quizUuid = created.publicUuid;
        this.isEdit.set(true);
        void this.router.navigate([ROUTES.LMS.quizEdit(created.publicUuid)], { replaceUrl: true });
        return true;
      }
    }
    return false;
  }

  protected addOption(): void {
    const group = this.fb.nonNullable.group({
      label: this.fb.control<string | null>(null),
      isCorrect: this.fb.control<boolean>(false),
    });
    this.optionsArray.push(
      group as unknown as FormGroup<{
        label: FormControl<string | null>;
        isCorrect: FormControl<boolean>;
      }>,
    );
  }

  protected removeOption(index: number): void {
    this.optionsArray.removeAt(index);
  }

  private populateFromDetail(detail: QuizDetail): void {
    this.metadataForm.patchValue({
      title: detail.title,
      description: detail.description,
      dueAt: detail.dueAt ? this.toLocalDatetime(detail.dueAt) : null,
      timeLimitMinutes: detail.timeLimitMinutes,
      maxAttempts: detail.maxAttempts,
      maxScore: detail.maxScore,
    });
  }

  private resetQuestionForm(opts: { keepType?: QuestionType } = {}): void {
    this.questionForm.reset({
      type: opts.keepType ?? QuestionType.MultipleChoice,
      prompt: null,
      points: 5,
      correctBoolean: true,
      expectedKeywords: null,
    });
    this.optionsArray.clear();
    for (const opt of this.makeDefaultOptions()) {
      this.optionsArray.push(
        opt as unknown as FormGroup<{
          label: FormControl<string | null>;
          isCorrect: FormControl<boolean>;
        }>,
      );
    }
  }

  private makeDefaultOptions(): FormGroup[] {
    return [
      this.fb.nonNullable.group({
        label: this.fb.control<string | null>(null),
        isCorrect: this.fb.control<boolean>(true),
      }),
      this.fb.nonNullable.group({
        label: this.fb.control<string | null>(null),
        isCorrect: this.fb.control<boolean>(false),
      }),
    ];
  }

  private toLocalDatetime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }
}

function aiToCreateQuestionRequest(req: CreateAiQuestionRequest): CreateQuestionRequest {
  switch (req.type) {
    case 'MC': {
      const options = (req.options ?? [])
        .filter((o) => (o.label ?? '').trim().length > 0)
        .map((o) => ({
          label: o.label.trim(),
          isCorrect: !!o.isCorrect,
          explanation: o.explanation ?? null,
        }));
      return {
        type: QuestionType.MultipleChoice,
        prompt: req.prompt,
        points: req.points,
        options,
      };
    }
    case 'TF': {
      const correct = (req.options ?? []).find((o) => o.isCorrect);
      return {
        type: QuestionType.TrueFalse,
        prompt: req.prompt,
        points: req.points,
        correctBoolean: correct ? /^verdader|^true$/i.test(correct.label.trim()) : true,
      };
    }
    case 'SHORT_ANSWER': {
      return {
        type: QuestionType.ShortAnswer,
        prompt: req.prompt,
        points: req.points,
        expectedKeywords: req.aiRationale ? req.aiRationale : null,
      };
    }
  }
}
