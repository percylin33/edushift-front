import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Pill que diferencia rúbricas del catálogo MINEDU (`isSystem=true`)
 * de las creadas por el tenant. Las MINEDU son read-only por contrato
 * (`RUB_SYSTEM_READ_ONLY`); el badge avisa al usuario antes de
 * intentar editarlas.
 */
@Component({
  selector: 'app-rubric-system-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isSystem()) {
      <span class="badge badge-primary" title="Rúbrica oficial MINEDU — no editable"> MINEDU </span>
    } @else if (isFork()) {
      <span class="badge badge-info" title="Forkeada de otra rúbrica"> Fork </span>
    } @else {
      <span class="badge badge-secondary">Personalizada</span>
    }
  `,
})
export class RubricSystemBadgeComponent {
  readonly isSystem = input.required<boolean>();
  readonly parentPublicUuid = input<string | undefined>(undefined);

  protected readonly isFork = computed(() => !this.isSystem() && !!this.parentPublicUuid());
}
