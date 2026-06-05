import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EnrollmentStatus } from '@core/enums';

/**
 * Visual chip for {@link EnrollmentStatus}. Mirrors the convention used
 * by {@code UserStatusBadgeComponent}: design-system tiers
 * (success / warning / danger / info / neutral), Spanish labels owned
 * here so the table cells stay terse.
 *
 * <h3>Color rationale</h3>
 * <ul>
 *   <li>{@code Enrolled}  → success (the active happy path).</li>
 *   <li>{@code Pending}   → info     (awaiting paperwork; not a failure).</li>
 *   <li>{@code Graduated} → neutral  (positive but no longer active).</li>
 *   <li>{@code Transferred}/{@code Withdrawn} → warning/neutral
 *       respectively. Withdrawn is the closest to "off the system".</li>
 * </ul>
 */
@Component({
  selector: 'app-enrollment-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClass()">{{ label() }}</span>
  `
})
export class EnrollmentStatusBadgeComponent {
  readonly status = input.required<EnrollmentStatus>();

  readonly label = computed(
    () => EnrollmentStatusBadgeComponent.LABELS[this.status()] ?? this.status()
  );
  readonly badgeClass = computed(
    () => `badge ${EnrollmentStatusBadgeComponent.TIER[this.status()] ?? 'badge-neutral'}`
  );

  private static readonly LABELS: Readonly<Record<EnrollmentStatus, string>> = {
    [EnrollmentStatus.Pending]:     'Pendiente',
    [EnrollmentStatus.Enrolled]:    'Matriculado',
    [EnrollmentStatus.Graduated]:   'Egresado',
    [EnrollmentStatus.Transferred]: 'Trasladado',
    [EnrollmentStatus.Withdrawn]:   'Retirado'
  };

  private static readonly TIER: Readonly<Record<EnrollmentStatus, string>> = {
    [EnrollmentStatus.Pending]:     'badge-info',
    [EnrollmentStatus.Enrolled]:    'badge-success',
    [EnrollmentStatus.Graduated]:   'badge-neutral',
    [EnrollmentStatus.Transferred]: 'badge-warning',
    [EnrollmentStatus.Withdrawn]:   'badge-neutral'
  };
}
