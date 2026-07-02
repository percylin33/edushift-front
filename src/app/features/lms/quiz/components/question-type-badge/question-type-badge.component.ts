import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { QuestionType } from '../../models/quiz.model';

/**
 * Badge visual para el tipo de pregunta (MC / TF / SHORT_ANSWER).
 * Reusa el mismo patrón de {@code QuizLifecycleBadgeComponent}.
 *
 * <p>Standalone, OnPush, sin estado interno. El padre pasa el
 * {@link QuestionType}; el color codifica visualmente el tipo
 * (azul = MC, ámbar = TF, púrpura = SHORT_ANSWER).</p>
 */
@Component({
  selector: 'app-question-type-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      [class]="colorClass()"
      [attr.aria-label]="'Tipo: ' + label()"
    >
      <span class="h-1.5 w-1.5 rounded-full" [class]="dotClass()"></span>
      {{ label() }}
    </span>
  `,
})
export class QuestionTypeBadgeComponent {
  @Input({ required: true }) set type(value: QuestionType) {
    this.#type.set(value);
  }

  readonly #type = signal<QuestionType>(QuestionType.MultipleChoice);

  readonly label = computed(() => TYPE_LABEL[this.#type()]);
  readonly colorClass = computed(() => TYPE_COLOR[this.#type()]);
  readonly dotClass = computed(() => TYPE_DOT[this.#type()]);
}

const TYPE_LABEL: Record<QuestionType, string> = {
  [QuestionType.MultipleChoice]: 'Opción múltiple',
  [QuestionType.TrueFalse]: 'Verdadero / Falso',
  [QuestionType.ShortAnswer]: 'Respuesta corta',
};

const TYPE_COLOR: Record<QuestionType, string> = {
  [QuestionType.MultipleChoice]: 'border-blue-300 bg-blue-50 text-blue-700',
  [QuestionType.TrueFalse]: 'border-amber-300 bg-amber-50 text-amber-700',
  [QuestionType.ShortAnswer]: 'border-purple-300 bg-purple-50 text-purple-700',
};

const TYPE_DOT: Record<QuestionType, string> = {
  [QuestionType.MultipleChoice]: 'bg-blue-500',
  [QuestionType.TrueFalse]: 'bg-amber-500',
  [QuestionType.ShortAnswer]: 'bg-purple-500',
};
