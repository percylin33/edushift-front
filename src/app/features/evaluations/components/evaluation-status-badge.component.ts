import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  EVALUATION_STATUS_BADGE_CLASS,
  EVALUATION_STATUS_LABELS,
  EvaluationStatus
} from '../models';

/**
 * Pill-style badge para {@link EvaluationStatus}. Mantiene consistencia
 * visual entre listing, detail y modal de edición.
 */
@Component({
  selector: 'app-evaluation-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="badgeClass()">
      {{ label() }}
    </span>
  `
})
export class EvaluationStatusBadgeComponent {
  readonly status = input.required<EvaluationStatus>();

  protected readonly label = computed(
    () => EVALUATION_STATUS_LABELS[this.status()]
  );
  protected readonly badgeClass = computed(
    () => EVALUATION_STATUS_BADGE_CLASS[this.status()]
  );
}
