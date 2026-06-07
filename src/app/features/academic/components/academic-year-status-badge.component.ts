import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AcademicYearStatus } from '../models';

/**
 * Visual chip para {@link AcademicYearStatus}. Sigue la misma
 * convención que {@code EnrollmentStatusBadgeComponent}: tiers del
 * design-system (success/warning/info/neutral), labels en español
 * mantenidas aquí.
 *
 * <h3>Color rationale</h3>
 * <ul>
 *   <li>{@code ACTIVE}   → success (el año en curso, happy path).</li>
 *   <li>{@code PLANNING} → info (creado pero aún no activado).</li>
 *   <li>{@code CLOSED}   → neutral (terminal; ya no admite mutaciones).</li>
 * </ul>
 */
@Component({
  selector: 'app-academic-year-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClass()">{{ label() }}</span>
  `
})
export class AcademicYearStatusBadgeComponent {
  readonly status = input.required<AcademicYearStatus>();

  readonly label = computed(
    () => AcademicYearStatusBadgeComponent.LABELS[this.status()] ?? this.status()
  );
  readonly badgeClass = computed(
    () => `badge ${AcademicYearStatusBadgeComponent.TIER[this.status()] ?? 'badge-neutral'}`
  );

  private static readonly LABELS: Readonly<Record<AcademicYearStatus, string>> = {
    [AcademicYearStatus.Planning]: 'Planificación',
    [AcademicYearStatus.Active]:   'Activo',
    [AcademicYearStatus.Closed]:   'Cerrado'
  };

  private static readonly TIER: Readonly<Record<AcademicYearStatus, string>> = {
    [AcademicYearStatus.Planning]: 'badge-info',
    [AcademicYearStatus.Active]:   'badge-success',
    [AcademicYearStatus.Closed]:   'badge-neutral'
  };
}
