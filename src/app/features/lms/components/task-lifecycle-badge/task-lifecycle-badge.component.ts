import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { TaskLifecycle } from '../../models';

/**
 * Badge visual para los lifecycles de un task. El color codifica el
 * estado en consonancia con la convención del módulo academic (gris
 * para draft, verde para published, rojo apagado para closed).
 *
 * <p>Standalone, OnPush, sin estado interno. El padre pasa el
 * {@link TaskLifecycle} y opcionalmente un tamaño (sm/md); el resto
 * sale del {@code computed}.</p>
 */
@Component({
  selector: 'app-task-lifecycle-badge',
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
export class TaskLifecycleBadgeComponent {
  @Input({ required: true }) set lifecycle(value: TaskLifecycle) {
    this.#lifecycle.set(value);
  }
  @Input() size: 'sm' | 'md' = 'sm';

  readonly #lifecycle = signal<TaskLifecycle>(TaskLifecycle.Draft);

  readonly label = computed(() => LIFECYCLE_LABEL[this.#lifecycle()]);
  readonly colorClass = computed(() => LIFECYCLE_COLOR[this.#lifecycle()]);
  readonly dotClass = computed(() => LIFECYCLE_DOT[this.#lifecycle()]);
  readonly sizeClass = computed(() =>
    this.size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : 'px-2.5 py-1 text-sm'
  );
}

const LIFECYCLE_LABEL: Record<TaskLifecycle, string> = {
  [TaskLifecycle.Draft]: 'Borrador',
  [TaskLifecycle.Published]: 'Publicada',
  [TaskLifecycle.Closed]: 'Cerrada'
};

const LIFECYCLE_COLOR: Record<TaskLifecycle, string> = {
  [TaskLifecycle.Draft]: 'border-slate-300 bg-slate-100 text-slate-700',
  [TaskLifecycle.Published]: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  [TaskLifecycle.Closed]: 'border-rose-300 bg-rose-50 text-rose-700'
};

const LIFECYCLE_DOT: Record<TaskLifecycle, string> = {
  [TaskLifecycle.Draft]: 'bg-slate-500',
  [TaskLifecycle.Published]: 'bg-emerald-500',
  [TaskLifecycle.Closed]: 'bg-rose-500'
};
