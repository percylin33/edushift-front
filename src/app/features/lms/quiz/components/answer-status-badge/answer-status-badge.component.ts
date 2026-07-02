import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { ANSWER_STATUS_COLOR, ANSWER_STATUS_LABEL, AnswerStatus } from '../../models/attempt.model';

const LABEL: Record<AnswerStatus, string> = ANSWER_STATUS_LABEL;
const COLOR: Record<AnswerStatus, string> = ANSWER_STATUS_COLOR;
const DOT: Record<AnswerStatus, string> = {
  [AnswerStatus.Empty]: 'bg-slate-400',
  [AnswerStatus.Saved]: 'bg-blue-500',
  [AnswerStatus.AutoGraded]: 'bg-violet-500',
  [AnswerStatus.ManuallyGraded]: 'bg-emerald-500',
};

/**
 * Tiny pill that mirrors the lifecycle of a single answer row
 * (FE-7b.2). 4 states: Empty / Saved / AutoGraded / ManuallyGraded.
 */
@Component({
  selector: 'app-answer-status-badge',
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
export class AnswerStatusBadgeComponent {
  private readonly _status = signal<AnswerStatus>(AnswerStatus.Empty);

  @Input({ required: true })
  set status(value: AnswerStatus) {
    this._status.set(value);
  }
  get status(): AnswerStatus {
    return this._status();
  }

  protected readonly label = computed(() => LABEL[this._status()]);
  protected readonly color = computed(() => COLOR[this._status()]);
  protected readonly dot = computed(() => DOT[this._status()]);
  protected readonly title = computed(() => `Estado: ${this.label()}`);
}
