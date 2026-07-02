import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import {
  AttemptStatus,
  ATTEMPT_STATUS_COLOR,
  ATTEMPT_STATUS_DOT,
  ATTEMPT_STATUS_LABEL,
} from '../../models/attempt.model';

const LIFECYCLE_LABEL: Record<AttemptStatus, string> = ATTEMPT_STATUS_LABEL;
const LIFECYCLE_COLOR: Record<AttemptStatus, string> = ATTEMPT_STATUS_COLOR;
const LIFECYCLE_DOT: Record<AttemptStatus, string> = ATTEMPT_STATUS_DOT;

/**
 * Pill that shows the lifecycle of a {@code QuizAttempt} (FE-7b.2).
 *
 * <p>5 states, mapped to Tailwind color hints and Spanish labels. The
 * dot color follows the same convention as the {@code QuizLifecycleBadge}.</p>
 *
 * <pre>
 *   IN_PROGRESS  SUBMITTED  AUTO_GRADED  GRADED  EXPIRED
 * </pre>
 */
@Component({
  selector: 'app-attempt-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
      [class]="color()"
      [attr.title]="title()"
    >
      <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full" [class]="dot()"></span>
      {{ label() }}
    </span>
  `,
})
export class AttemptStatusBadgeComponent {
  private readonly _status = signal<AttemptStatus>(AttemptStatus.InProgress);

  @Input({ required: true })
  set status(value: AttemptStatus) {
    this._status.set(value);
  }
  get status(): AttemptStatus {
    return this._status();
  }

  protected readonly label = computed(() => LIFECYCLE_LABEL[this._status()]);
  protected readonly color = computed(() => LIFECYCLE_COLOR[this._status()]);
  protected readonly dot = computed(() => LIFECYCLE_DOT[this._status()]);
  protected readonly title = computed(() => `Estado del intento: ${this.label()}`);
}
