import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InvitationStatus } from '@core/enums';

/**
 * Visual chip for {@link InvitationStatus}. PENDING uses the info
 * palette (neutral but clearly distinct from the user's status
 * column); ACCEPTED is success; CANCELLED / EXPIRED render in muted
 * tones so they fade into the background of the audit table.
 */
@Component({
  selector: 'app-invitation-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="badgeClass()">{{ label() }}</span>`
})
export class InvitationStatusBadgeComponent {
  readonly status = input.required<InvitationStatus>();

  readonly label = computed(
    () => InvitationStatusBadgeComponent.LABELS[this.status()] ?? this.status()
  );
  readonly badgeClass = computed(
    () => `badge ${InvitationStatusBadgeComponent.TIER[this.status()] ?? 'badge-neutral'}`
  );

  private static readonly LABELS: Readonly<Record<InvitationStatus, string>> = {
    [InvitationStatus.Pending]:   'Pendiente',
    [InvitationStatus.Accepted]:  'Aceptada',
    [InvitationStatus.Cancelled]: 'Cancelada',
    [InvitationStatus.Expired]:   'Expirada'
  };

  private static readonly TIER: Readonly<Record<InvitationStatus, string>> = {
    [InvitationStatus.Pending]:   'badge-info',
    [InvitationStatus.Accepted]:  'badge-success',
    [InvitationStatus.Cancelled]: 'badge-neutral',
    [InvitationStatus.Expired]:   'badge-warning'
  };
}
