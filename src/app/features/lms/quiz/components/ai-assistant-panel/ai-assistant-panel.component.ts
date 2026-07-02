import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AiAssistantService } from '../../services/ai-assistant.service';
import {
  AiAssistantState,
  AiAssistantStatus,
  CreateAiQuestionRequest,
  QuestionSuggestion,
  emptyAiState,
} from '../../models/ai-assistant.model';
import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';

/**
 * AI Assistant panel (FE-7b.4 — stub).
 *
 * <p>Standalone component that asks the (currently stubbed) assistant for
 * question suggestions given a topic. The teacher can then:</p>
 * <ol>
 *   <li>Accept a suggestion → emits {@link accept} with a
 *       {@link CreateAiQuestionRequest} ready to be POSTed to
 *       {@code /quizzes/{uuid}/questions}.</li>
 *   <li>Regenerate → re-runs {@code suggest} with the same topic, replacing
 *       the list.</li>
 *   <li>Edit the prompt inline before accepting.</li>
 * </ol>
 *
 * <p>The component is designed to slot into the {@code QuizFormPage}
 * question bank sidebar; the FE-7b.1 wiring is out of scope for this
 * ticket (deferred until the real {@code LmsAiService} lands so the
 * acceptance flow can be tested end-to-end).</p>
 */
@Component({
  selector: 'app-ai-assistant-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconComponent,
    SpinnerComponent,
    EmptyStateComponent,
  ],
  template: `
    <section class="card" data-testid="ai-assistant-panel">
      <header class="card-body flex flex-col gap-3 border-b border-surface-muted pb-4">
        <div class="flex items-center gap-2">
          <app-icon name="sparkles" [size]="18" />
          <h2 class="text-base font-semibold text-content">Asistente de IA</h2>
          <span class="badge badge-neutral badge-sm">Stub</span>
        </div>
        <p class="text-xs text-content-muted">
          Sugiere preguntas para tu quiz a partir de un tema. Esta vista es un stub mientras el
          backend <code class="font-mono">LmsAiService</code> está en desarrollo.
        </p>

        <label class="form-label" for="ai-topic">Tema</label>
        <input
          id="ai-topic"
          type="text"
          class="input"
          placeholder="p. ej. Capitales de Europa"
          [formControl]="topicControl"
        />

        <label class="form-label" for="ai-count">Cantidad</label>
        <input
          id="ai-count"
          type="number"
          class="input w-24"
          min="1"
          max="5"
          [formControl]="countControl"
        />

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            (click)="onGenerate()"
            [disabled]="state().status === Status.Loading"
          >
            @if (state().status === Status.Loading) {
              <app-spinner [size]="14" />
            } @else {
              <app-icon name="sparkles" [size]="14" />
            }
            Generar sugerencias
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            (click)="onRegenerate()"
            [disabled]="state().status === Status.Loading || state().suggestions.length === 0"
          >
            <app-icon name="refresh" [size]="14" />
            Regenerar
          </button>
        </div>

        @if (state().status === Status.Error && state().error) {
          <div class="alert alert-danger" role="alert">
            <app-icon name="alert-circle" [size]="14" />
            <span class="text-xs">{{ state().error }}</span>
          </div>
        }
      </header>

      <div class="card-body space-y-3">
        @if (state().status === Status.Loading) {
          <div class="flex items-center justify-center py-8">
            <app-spinner [size]="20" [label]="service.statusLabel(Status.Loading)" />
          </div>
        } @else if (state().suggestions.length === 0) {
          <app-empty-state
            icon="sparkles"
            title="Sin sugerencias aún"
            description="Indica un tema y pulsa Generar para que el asistente sugiera preguntas."
          />
        } @else {
          <ol class="space-y-3">
            @for (s of state().suggestions; track s.id) {
              <li class="rounded-md border border-surface-muted p-3" data-testid="ai-suggestion">
                <div class="flex items-start gap-2">
                  <span class="badge badge-info badge-sm">{{ s.questionType }}</span>
                  <span class="text-xs text-content-muted">{{ s.points }} pts</span>
                </div>
                <textarea
                  rows="2"
                  class="textarea mt-2"
                  [value]="s.prompt"
                  (input)="onEditPrompt(s.id, $any($event.target).value)"
                ></textarea>
                @if (s.questionType === 'MC') {
                  <ul class="mt-2 space-y-1 text-sm">
                    @for (opt of s.options; track opt.label) {
                      <li class="flex items-center gap-2">
                        <app-icon [name]="opt.isCorrect ? 'check' : 'x'" [size]="12" />
                        <span
                          [class.text-emerald-700]="opt.isCorrect"
                          [class.text-content-muted]="!opt.isCorrect"
                        >
                          {{ opt.label }}
                        </span>
                      </li>
                    }
                  </ul>
                }
                <p class="mt-2 text-xs italic text-content-muted">{{ s.rationale }}</p>
                <div class="mt-2 flex justify-end gap-2">
                  <button type="button" class="btn btn-ghost btn-xs" (click)="onDiscard(s.id)">
                    <app-icon name="x" [size]="12" />
                    Descartar
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary btn-xs"
                    (click)="onAccept(s)"
                    data-testid="ai-accept"
                  >
                    <app-icon name="check" [size]="12" />
                    Aceptar
                  </button>
                </div>
              </li>
            }
          </ol>
        }
      </div>
    </section>
  `,
})
export class AiAssistantPanelComponent {
  protected readonly service = inject(AiAssistantService);
  /** Re-exported for template comparison against {@link AiAssistantStatus.Loading}. */
  protected readonly Status = AiAssistantStatus as typeof AiAssistantStatus;

  protected readonly topicControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  });
  protected readonly countControl = new FormControl<number>(3, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1), Validators.max(5)],
  });

  protected readonly state = signal<AiAssistantState>(emptyAiState());

  @Output() readonly accept = new EventEmitter<CreateAiQuestionRequest>();

  async onGenerate(): Promise<void> {
    const topic = this.topicControl.value.trim();
    if (topic.length < 2) {
      this.state.set({
        ...emptyAiState(),
        status: AiAssistantStatus.Error,
        error: 'Indica un tema de al menos 2 caracteres.',
      });
      return;
    }
    this.state.set({ ...this.state(), status: AiAssistantStatus.Loading, error: null });
    try {
      const suggestions = await firstValueFrom(
        this.service.suggest({ topic, count: this.countControl.value }),
      );
      this.state.set({
        status: AiAssistantStatus.Success,
        topic,
        suggestions,
        error: null,
      });
    } catch (err) {
      const e = err as { message?: string };
      this.state.set({
        status: AiAssistantStatus.Error,
        topic,
        suggestions: [],
        error: e?.message ?? 'Error desconocido.',
      });
    }
  }

  async onRegenerate(): Promise<void> {
    await this.onGenerate();
  }

  onEditPrompt(id: string, newPrompt: string): void {
    this.state.update((s) => ({
      ...s,
      suggestions: s.suggestions.map((it) => (it.id === id ? { ...it, prompt: newPrompt } : it)),
    }));
  }

  onDiscard(id: string): void {
    this.state.update((s) => ({
      ...s,
      suggestions: s.suggestions.filter((it) => it.id !== id),
    }));
  }

  onAccept(suggestion: QuestionSuggestion): void {
    this.accept.emit({
      prompt: suggestion.prompt,
      type: suggestion.questionType,
      points: suggestion.points,
      options: suggestion.options,
      aiRationale: suggestion.rationale,
    });
    this.onDiscard(suggestion.id);
  }
}
