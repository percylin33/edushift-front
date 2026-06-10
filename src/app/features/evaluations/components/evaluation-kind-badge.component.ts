import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  EVALUATION_KIND_BADGE_CLASS,
  EVALUATION_KIND_LABELS,
  EvaluationKind
} from '../models';

/**
 * Pill-style badge para {@link EvaluationKind} (TASK / QUIZ / EXAM /
 * RUBRIC / COMPETENCY). Color-codea por tipo siguiendo la matriz
 * `kind × scale` de ADR-5B.2.
 */
@Component({
  selector: 'app-evaluation-kind-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="badgeClass()">
      {{ label() }}
    </span>
  `
})
export class EvaluationKindBadgeComponent {
  readonly kind = input.required<EvaluationKind>();

  protected readonly label = computed(
    () => EVALUATION_KIND_LABELS[this.kind()]
  );
  protected readonly badgeClass = computed(
    () => EVALUATION_KIND_BADGE_CLASS[this.kind()]
  );
}
