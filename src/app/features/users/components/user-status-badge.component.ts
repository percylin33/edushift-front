import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UserStatus } from '@core/enums';

/**
 * Visual chip for {@link UserStatus}. Uses the design-system badge
 * palette: success/warning/danger/info/neutral so the cells stay
 * legible across the table. Labels are user-facing Spanish; mapping
 * lives in this component (one source of truth) instead of being
 * sprinkled across templates.
 */
@Component({
  selector: 'app-user-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClass()">{{ label() }}</span>
  `
})
export class UserStatusBadgeComponent {
  readonly status = input.required<UserStatus>();

  readonly label = computed(() => UserStatusBadgeComponent.LABELS[this.status()] ?? this.status());
  readonly badgeClass = computed(
    () => `badge ${UserStatusBadgeComponent.TIER[this.status()] ?? 'badge-neutral'}`
  );

  private static readonly LABELS: Readonly<Record<UserStatus, string>> = {
    [UserStatus.Active]:              'Activo',
    [UserStatus.Suspended]:           'Suspendido',
    [UserStatus.Locked]:              'Bloqueado',
    [UserStatus.Inactive]:            'Inactivo',
    [UserStatus.PendingVerification]: 'Pendiente'
  };

  private static readonly TIER: Readonly<Record<UserStatus, string>> = {
    [UserStatus.Active]:              'badge-success',
    [UserStatus.Suspended]:           'badge-warning',
    [UserStatus.Locked]:              'badge-danger',
    [UserStatus.Inactive]:            'badge-neutral',
    [UserStatus.PendingVerification]: 'badge-info'
  };
}
