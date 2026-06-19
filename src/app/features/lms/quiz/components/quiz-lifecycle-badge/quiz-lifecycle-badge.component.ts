import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal
} from '@angular/core';
import { QuizStatus } from '../../models/quiz.model';

/**
 * Badge visual para el lifecycle de un quiz (DRAFT / PUBLISHED / CLOSED).
 * Replica el patrón de {@code TaskLifecycleBadgeComponent} (FE-7a.1) —
 * gris para draft, verde para published, rojo apagado para closed.
 *
 * <p>Standalone, OnPush, sin estado interno. El padre pasa el
 * {@link QuizStatus} y opcionalmente un tamaño (sm/md); el resto sale
 * del {@code computed}.</p>
 */
@Component({
  selector: 'app-quiz-lifecycle-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-full border font-medium"
      [class]="sizeClass() + ' ' + colorClass()"
      [attr.aria-label]="'Estado: ' + label()"
    >
      <span class="h-1.5 w-1.5 rounded-full" [class]="dotClass()"></span>
      {{ label() }}
    </span>
  `
})
export class QuizLifecycleBadgeComponent {
  @Input({ required: true }) set status(value: QuizStatus) {
    this.#status.set(value);
  }
  @Input() size: 'sm' | 'md' = 'sm';

  readonly #status = signal<QuizStatus>(QuizStatus.Draft);

  readonly label = computed(() => LIFECYCLE_LABEL[this.#status()]);
  readonly colorClass = computed(() => LIFECYCLE_COLOR[this.#status()]);
  readonly dotClass = computed(() => LIFECYCLE_DOT[this.#status()]);
  readonly sizeClass = computed(() =>
    this.size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
  );
}

const LIFECYCLE_LABEL: Record<QuizStatus, string> = {
  [QuizStatus.Draft]: 'Borrador',
  [QuizStatus.Published]: 'Publicado',
  [QuizStatus.Closed]: 'Cerrado'
};

const LIFECYCLE_COLOR: Record<QuizStatus, string> = {
  [QuizStatus.Draft]: 'border-slate-300 bg-slate-100 text-slate-700',
  [QuizStatus.Published]: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  [QuizStatus.Closed]: 'border-rose-300 bg-rose-50 text-rose-700'
};

const LIFECYCLE_DOT: Record<QuizStatus, string> = {
  [QuizStatus.Draft]: 'bg-slate-500',
  [QuizStatus.Published]: 'bg-emerald-500',
  [QuizStatus.Closed]: 'bg-rose-500'
};
