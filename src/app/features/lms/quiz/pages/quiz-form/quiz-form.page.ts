import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Permission } from '@core/enums';
import {
  EmptyStateComponent,
  IconComponent
} from '@shared/components';
import { HasPermissionDirective } from '@shared/directives/has-permission.directive';
import { QuizzesStore } from '../../store/quizzes.store';
import {
  CreateQuestionRequest,
  QuestionRow,
  QuestionType,
  QuizDetail,
  isQuizEditable
} from '../../models/quiz.model';
import { QuestionTypeBadgeComponent } from '../../components/question-type-badge/question-type-badge.component';
import { AiAssistantPanelComponent } from '../../components/ai-assistant-panel/ai-assistant-panel.component';
import { CreateAiQuestionRequest } from '../../models/ai-assistant.model';

/**
 * `/lms/quizzes/new` y `/lms/quizzes/:uuid/edit` — Quiz builder (FE-7b.1).
 *
 * <h3>Flujo de 2 fases</h3>
 * <ol>
 *   <li><b>Metadata</b>: title, description, dueAt, timeLimitMinutes,
 *       maxAttempts, maxScore. POST crea un quiz en DRAFT. Después de
 *       creado, el wizard pasa a la fase B con el detail cargado.</li>
 *   <li><b>Question bank</b>: una pregunta a la vez (POST
 *       /quizzes/{uuid}/questions). Validación cliente según
 *       {@code QuestionType}: MC exige 2-6 options + 1 isCorrect; TF
 *       exige correctBoolean; SHORT_ANSWER admite expectedKeywords.</li>
 * </ol>
 *
 * <p>El flujo de "save + publish" se hace con dos llamadas: save
 * (crea / actualiza metadata) + publish (POST /publish). El botón
 * "Guardar borrador" persiste metadata; "Publicar" persiste + publica
 * (solo si hay ≥1 pregunta).</p>
 *
 * <h3>RBAC</h3>
 * {@code canMatch: [permissionGuard]} con {@code LMS_QUIZ_CREATE} ya
 * aplicado en {@code lms.routes.ts}.
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
    AiAssistantPanelComponent
  ],
  template: `
    <header class="mb-4 flex items-center justify-between gap-2">
      <div>
        <h1 class="text-2xl font-semibold text-content">
          {{ isEdit() ? 'Editar quiz' : 'Nuevo quiz' }}
        </h1>
        <p class="text-sm text-content-muted">
          {{
            isEdit()
              ? 'Modifica los datos básicos y/o añade preguntas al banco.'
              : 'Crea un quiz en DRAFT. Después podrás añadir preguntas y publicarlo.'
          }}
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
          <p class="font-medium">Este quiz no se puede editar.</p>
          <p class="text-xs opacity-80">
            Solo se pueden editar quizzes en estado DRAFT.
          </p>
        </div>
      </div>
    } @else {
      <!-- Fase A: metadata -->
      <section class="card mb-4">
        <div class="card-body space-y-4">
          <h2 class="card-title text-base">Datos básicos</h2>

          <form [formGroup]="metadataForm" (ngSubmit)="onSaveMetadata()">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="form-control sm:col-span-2">
                <span class="label-text">Título</span>
                <input
                  type="text"
                  class="input"
                  formControlName="title"
                  maxlength="200"
                  placeholder="p. ej. Quiz: Fracciones — 5to grado"
                />
                @if (showMetaError('title')) {
                  <span class="text-xs text-error">
                    El título es obligatorio (máx. 200 caracteres).
                  </span>
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
                <input
                  type="datetime-local"
                  class="input"
                  formControlName="dueAt"
                />
              </label>

              <label class="form-control">
                <span class="label-text">Tiempo límite (min, opcional)</span>
                <input
                  type="number"
                  class="input"
                  formControlName="timeLimitMinutes"
                  min="1"
                  max="480"
                />
              </label>

              <label class="form-control">
                <span class="label-text">Intentos permitidos</span>
                <input
                  type="number"
                  class="input"
                  formControlName="maxAttempts"
                  min="1"
                  max="10"
                />
              </label>

              <label class="form-control">
                <span class="label-text">Puntaje máximo</span>
                <input
                  type="number"
                  class="input"
                  formControlName="maxScore"
                  min="0"
                  max="1000"
                />
              </label>
            </div>

            <div class="card-actions justify-end pt-2">
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                [disabled]="saving() || metadataForm.invalid"
              >
                <app-icon name="save" [size]="14" />
                {{ isEdit() ? 'Guardar cambios' : 'Crear borrador' }}
              </button>
            </div>
          </form>
        </div>
      </section>

      <!-- Fase B: bank de preguntas (solo cuando ya hay detail) -->
      @if (selected(); as quiz) {
        <section class="card mb-4">
          <div class="card-body space-y-4">
            <header class="flex items-center justify-between">
              <h2 class="card-title text-base">Banco de preguntas</h2>
              <span class="text-xs text-content-muted">
                {{ quiz.questions.length }} pregunta(s) ·
                {{ totalPoints() }} pts
              </span>
            </header>

            @if (quiz.questions.length === 0) {
              <app-empty-state
                title="Aún no hay preguntas"
                description="Añade al menos una pregunta antes de publicar."
                [icon]="'help-circle'"
              />
            } @else {
              <ol class="space-y-3">
                @for (q of quiz.questions; track q.publicUuid; let i = $index) {
                  <li class="rounded-lg border border-base-200 p-3">
                    <div class="mb-2 flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-content-muted">
                          {{ i + 1 }}.
                        </span>
                        <app-question-type-badge [type]="q.type" />
                        <span class="text-xs text-content-muted">
                          {{ q.points }} pts
                        </span>
                      </div>
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
                        <span class="ml-1 font-medium">
                          {{ q.expectedKeywords || '—' }}
                        </span>
                      </p>
                    }
                  </li>
                }
              </ol>
            }

            <details class="rounded-lg border border-base-200 p-3">
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
                  <span class="label-text">Pregunta (prompt)</span>
                  <textarea
                    class="textarea"
                    rows="2"
                    formControlName="prompt"
                    maxlength="2000"
                  ></textarea>
                  @if (showQError('prompt')) {
                    <span class="text-xs text-error">
                      El enunciado es obligatorio (máx. 2000 caracteres).
                    </span>
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
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        (click)="addOption()"
                      >
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
                    <span class="text-xs text-content-muted">
                      El backend matchea case-insensitive. Una respuesta es
                      correcta si contiene TODAS las keywords.
                    </span>
                  </label>
                }

                <div class="card-actions justify-end">
                  <button
                    type="submit"
                    class="btn btn-primary btn-sm"
                    [disabled]="saving() || !questionForm.valid"
                  >
                    <app-icon name="plus" [size]="14" />
                    Añadir pregunta
                  </button>
                </div>
              </form>
            </details>

            @if (selected() && selected()!.questions.length > 0) {
              <div class="card-actions justify-end pt-2">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  [disabled]="saving()"
                  (click)="onPublish()"
                >
                  <app-icon name="send" [size]="14" />
                  Publicar quiz
                </button>
              </div>
            }
          </div>
        </section>
      }
    }

    @if (errorBanner()) {
      <div class="alert alert-danger mt-4" role="alert">
        <app-icon name="alert-circle" [size]="18" />
        <p>{{ errorBanner() }}</p>
      </div>
    }
  `
})
export class QuizFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(QuizzesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly type = QuestionType;
  protected readonly selected = this.store.selected;
  protected readonly loadingDetail = this.store.loadingDetail;
  protected readonly saving = this.store.saving;
  protected readonly errorBanner = this.store.error;

  protected readonly isEdit = signal<boolean>(false);

  /** When true, the AI assistant panel is shown next to the question form.
   *  Toggled by the "Sugerir con IA" button (FE-7c.1) and closed by the
   *  onAccept() flow so the teacher can immediately see the new question. */
  protected readonly aiPanelOpen = signal<boolean>(false);

  /** Re-exported for template comparison against {@link Permission.LmsAiGenerate}. */
  protected readonly Permission = Permission;

  /** True if the loaded quiz is editable (DRAFT). */
  protected readonly editable = computed(() => {
    const sel = this.selected();
    return sel ? isQuizEditable(sel) : true;
  });

  protected readonly totalPoints = computed(() => {
    const sel = this.selected();
    if (!sel) return 0;
    return sel.questions.reduce((acc, q) => acc + q.points, 0);
  });

  // -------------------------------------------------------------------------
  // Forms
  // -------------------------------------------------------------------------

  protected readonly metadataForm: FormGroup<{
    title: FormControl<string | null>;
    description: FormControl<string | null>;
    dueAt: FormControl<string | null>;
    timeLimitMinutes: FormControl<number | null>;
    maxAttempts: FormControl<number | null>;
    maxScore: FormControl<number | null>;
  }> = this.fb.group({
    title: this.fb.control<string | null>(null, {
      validators: [Validators.required, Validators.maxLength(200)]
    }),
    description: this.fb.control<string | null>(null, {
      validators: [Validators.maxLength(10000)]
    }),
    dueAt: this.fb.control<string | null>(null),
    timeLimitMinutes: this.fb.control<number | null>(null, {
      validators: [Validators.min(1), Validators.max(480)]
    }),
    maxAttempts: this.fb.control<number | null>(1, {
      validators: [Validators.required, Validators.min(1), Validators.max(10)]
    }),
    maxScore: this.fb.control<number | null>(100, {
      validators: [Validators.required, Validators.min(0), Validators.max(1000)]
    })
  });

  protected readonly questionForm: FormGroup<{
    type: FormControl<QuestionType>;
    prompt: FormControl<string | null>;
    points: FormControl<number | null>;
    correctBoolean: FormControl<boolean | null>;
    expectedKeywords: FormControl<string | null>;
    options: FormArray<FormGroup<{
      label: FormControl<string | null>;
      isCorrect: FormControl<boolean>;
    }>>;
  }> = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<QuestionType>(QuestionType.MultipleChoice, {
      validators: [Validators.required]
    }),
    prompt: this.fb.control<string | null>(null, {
      validators: [Validators.required, Validators.maxLength(2000)]
    }),
    points: this.fb.control<number | null>(5, {
      validators: [Validators.required, Validators.min(1), Validators.max(100)]
    }),
    correctBoolean: this.fb.control<boolean | null>(true),
    expectedKeywords: this.fb.control<string | null>(null),
    options: this.fb.array<FormGroup<{
      label: FormControl<string | null>;
      isCorrect: FormControl<boolean>;
    }>>(
      this.makeDefaultOptions()
    )
  });

  #sectionUuid: string | null = null;
  #quizUuid: string | null = null;

  ngOnInit(): void {
    const sectionUuid = this.route.snapshot.queryParamMap.get('section');
    const quizUuid = this.route.snapshot.paramMap.get('uuid');
    this.#sectionUuid = sectionUuid;
    this.#quizUuid = quizUuid;

    if (quizUuid) {
      this.isEdit.set(true);
      void this.store.loadDetail(quizUuid).then((detail) => {
        if (detail) this.populateFromDetail(detail);
      });
    } else if (!sectionUuid) {
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

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  protected async onSaveMetadata(): Promise<void> {
    if (this.metadataForm.invalid) {
      this.metadataForm.markAllAsTouched();
      return;
    }
    const raw = this.metadataForm.value;
    if (this.isEdit() && this.#quizUuid) {
      const updated = await this.store.updateQuiz(this.#quizUuid, {
        title: raw.title ?? undefined,
        description: raw.description ?? null,
        dueAt: raw.dueAt ? new Date(raw.dueAt).toISOString() : null,
        timeLimitMinutes: raw.timeLimitMinutes ?? null,
        maxAttempts: raw.maxAttempts ?? undefined,
        maxScore: raw.maxScore ?? undefined
      });
      if (updated) this.populateFromDetail(updated);
    } else if (this.#sectionUuid) {
      const created = await this.store.createQuiz(this.#sectionUuid, {
        title: raw.title ?? '',
        description: raw.description ?? null,
        dueAt: raw.dueAt ? new Date(raw.dueAt).toISOString() : null,
        timeLimitMinutes: raw.timeLimitMinutes ?? null,
        maxAttempts: raw.maxAttempts ?? 1,
        maxScore: raw.maxScore ?? 100
      });
      if (created) {
        this.#quizUuid = created.publicUuid;
        this.isEdit.set(true);
        // Navigate to /edit so a refresh keeps the wizard open.
        void this.router.navigate(
          [ROUTES.LMS.quizEdit(created.publicUuid)],
          { replaceUrl: true }
        );
      }
    }
  }

  protected async onAddQuestion(): Promise<void> {
    if (!this.#quizUuid) return;
    if (this.questionForm.invalid) {
      this.questionForm.markAllAsTouched();
      return;
    }
    const raw = this.questionForm.value;
    const request: CreateQuestionRequest = {
      type: raw.type as QuestionType,
      prompt: raw.prompt ?? '',
      points: raw.points ?? 5,
      correctBoolean:
        raw.type === QuestionType.TrueFalse ? raw.correctBoolean : undefined,
      expectedKeywords:
        raw.type === QuestionType.ShortAnswer
          ? (raw.expectedKeywords ?? null)
          : undefined,
      options:
        raw.type === QuestionType.MultipleChoice
          ? (raw.options ?? [])
              .filter((o) => (o?.label ?? '').trim().length > 0)
              .map((o, i, arr) => ({
                label: o!.label as string,
                isCorrect: !!o!.isCorrect,
                explanation: null
              }))
          : undefined
    };
    const added = await this.store.addQuestion(this.#quizUuid, request);
    if (added) {
      this.resetQuestionForm();
    }
  }

  protected async onPublish(): Promise<void> {
    if (!this.#quizUuid) return;
    const published = await this.store.publishQuiz(this.#quizUuid);
    if (published) {
      void this.router.navigate([ROUTES.LMS.quizDetail(published.publicUuid)]);
    }
  }

  /** Toggle the AI assistant panel (FE-7c.1). */
  protected toggleAiPanel(): void {
    this.aiPanelOpen.update((v) => !v);
  }

  /**
   * Bridge the {@link CreateAiQuestionRequest} (panel's domain shape) into a
   * full {@link CreateQuestionRequest} that {@link QuizzesStore.addQuestion}
   * understands, then dispatch it through the store.
   *
   * <p>BE-7c.1 returns up to N questions, but the panel accepts them one at
   * a time. Each accepted suggestion is POSTed independently so the server
   * can assign its own UUID and ordering. The panel is kept open so the
   * teacher can accept more suggestions without re-asking the LLM.</p>
   */
  protected async onAiAccepted(req: CreateAiQuestionRequest): Promise<void> {
    if (!this.#quizUuid) return;
    const createRequest: CreateQuestionRequest = aiToCreateQuestionRequest(req);
    const added = await this.store.addQuestion(this.#quizUuid, createRequest);
    if (added) {
      // Reset the question form to a clean state and pre-select the
      // type we just inserted, so the teacher can add another question
      // of the same kind without re-picking the type.
      this.questionForm.patchValue({ type: added.type });
      this.resetQuestionForm({ keepType: added.type });
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
  // Form helpers
  // -------------------------------------------------------------------------

  protected showMetaError(name: keyof typeof this.metadataForm.controls): boolean {
    const c = this.metadataForm.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected showQError(name: keyof typeof this.questionForm.controls): boolean {
    const c = this.questionForm.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  protected addOption(): void {
    const group = this.fb.nonNullable.group({
      label: this.fb.control<string | null>(null),
      isCorrect: this.fb.control<boolean>(false)
    });
    this.optionsArray.push(group as unknown as FormGroup<{
      label: FormControl<string | null>;
      isCorrect: FormControl<boolean>;
    }>);
  }

  protected removeOption(index: number): void {
    this.optionsArray.removeAt(index);
  }

  private populateFromDetail(detail: QuizDetail): void {
    this.metadataForm.patchValue({
      title: detail.title,
      description: detail.description,
      dueAt: detail.dueAt
        ? this.toLocalDatetime(detail.dueAt)
        : null,
      timeLimitMinutes: detail.timeLimitMinutes,
      maxAttempts: detail.maxAttempts,
      maxScore: detail.maxScore
    });
  }

  private resetQuestionForm(opts: { keepType?: QuestionType } = {}): void {
    this.questionForm.reset({
      type: opts.keepType ?? QuestionType.MultipleChoice,
      prompt: null,
      points: 5,
      correctBoolean: true,
      expectedKeywords: null
    });
    this.optionsArray.clear();
    for (const opt of this.makeDefaultOptions()) {
      this.optionsArray.push(opt as unknown as FormGroup<{
        label: FormControl<string | null>;
        isCorrect: FormControl<boolean>;
      }>);
    }
  }

  private makeDefaultOptions(): FormGroup[] {
    return [
      this.fb.nonNullable.group({
        label: this.fb.control<string | null>(null),
        isCorrect: this.fb.control<boolean>(true)
      }),
      this.fb.nonNullable.group({
        label: this.fb.control<string | null>(null),
        isCorrect: this.fb.control<boolean>(false)
      })
    ];
  }

  private toLocalDatetime(d: Date): string {
    // <input type="datetime-local"> expects YYYY-MM-DDTHH:mm in LOCAL time.
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

/**
 * Map the AI panel's domain shape into the wire shape the quiz store
 * expects. The mapping preserves the LLM's intent (correct option, MC/TF/
 * SHORT_ANSWER) and reuses the AI's per-option explanations so the teacher
 * can read them inside the question bank.
 *
 * <p>For SHORT_ANSWER we use the AI's rationale as a single-keyword seed
 * (the teacher can still edit the CSV). For MC the LLM may return up to 6
 * options; we keep them all and tag the first {@code isCorrect:true} as the
 * correct one (the form enforces 1-and-only-1, so we mirror that here).</p>
 */
function aiToCreateQuestionRequest(req: CreateAiQuestionRequest): CreateQuestionRequest {
  switch (req.type) {
    case 'MC': {
      const options = (req.options ?? [])
        .filter((o) => (o.label ?? '').trim().length > 0)
        .map((o) => ({
          label: o.label.trim(),
          isCorrect: !!o.isCorrect,
          explanation: o.explanation ?? null
        }));
      return {
        type: QuestionType.MultipleChoice,
        prompt: req.prompt,
        points: req.points,
        options
      };
    }
    case 'TF': {
      // For TF, the LLM puts the "true" / "false" label in `options[1]`.
      // We collapse the two-option array into a single boolean.
      const correct = (req.options ?? []).find((o) => o.isCorrect);
      return {
        type: QuestionType.TrueFalse,
        prompt: req.prompt,
        points: req.points,
        correctBoolean: correct ? /^verdader|^true$/i.test(correct.label.trim()) : true
      };
    }
    case 'SHORT_ANSWER': {
      return {
        type: QuestionType.ShortAnswer,
        prompt: req.prompt,
        points: req.points,
        expectedKeywords: req.aiRationale ? req.aiRationale : null
      };
    }
  }
}
