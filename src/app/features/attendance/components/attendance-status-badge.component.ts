import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Visual chip for attendance statuses (FE-6.2). One component, two
 * domains — the colour tier + Spanish label are derived from a
 * single `status` input typed as `string`, validated at runtime via
 * the {@code AttendanceRecordStatus} / {@code AttendanceSessionStatus}
 * unions (the model files only export `type` aliases, not enums, so
 * we use string-literal keys here).
 *
 * <h3>Color rationale</h3>
 * <ul>
 *   <li>{@code PRESENT}   → success (the happy path).</li>
 *   <li>{@code LATE}      → warning  (arrived but past the cutoff).</li>
 *   <li>{@code EXCUSED}   → info     (justified absence; neutral).</li>
 *   <li>{@code ABSENT}    → danger   (the failure case).</li>
 *   <li>{@code ACTIVE}    → success  (open session, scans allowed).</li>
 *   <li>{@code CLOSED}    → neutral  (terminal state).</li>
 * </ul>
 */
@Component({
  selector: 'app-attendance-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="badgeClass()">{{ label() }}</span>`,
})
export class AttendanceStatusBadgeComponent {
  readonly status = input.required<string>();

  readonly label = computed(
    () => AttendanceStatusBadgeComponent.LABELS[this.status()] ?? this.status(),
  );
  readonly badgeClass = computed(
    () => `badge ${AttendanceStatusBadgeComponent.TIER[this.status()] ?? 'badge-neutral'}`,
  );

  private static readonly LABELS: Readonly<Record<string, string>> = {
    PRESENT: 'Presente',
    LATE: 'Tardanza',
    ABSENT: 'Ausente',
    EXCUSED: 'Justificado',
    ACTIVE: 'Activa',
    CLOSED: 'Cerrada',
  };

  private static readonly TIER: Readonly<Record<string, string>> = {
    PRESENT: 'badge-success',
    LATE: 'badge-warning',
    ABSENT: 'badge-error',
    EXCUSED: 'badge-info',
    ACTIVE: 'badge-success',
    CLOSED: 'badge-neutral',
  };
}
