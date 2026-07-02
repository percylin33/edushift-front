import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components';
import { ROUTES } from '@core/constants';

/**
 * Visual entry point to the notifications center. The unread badge is wired to
 * `NotificationsStore.unreadCount` once the feature is online; for now the
 * component renders a neutral state to keep the layout self-contained.
 */
@Component({
  selector: 'app-notifications-bell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <a
      [routerLink]="route"
      class="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-content-muted hover:bg-surface-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
      aria-label="Notificaciones"
      title="Notificaciones"
    >
      <app-icon name="bell" [size]="18" />
    </a>
  `,
})
export class NotificationsBellComponent {
  readonly route = ROUTES.NOTIFICATIONS.ROOT;
}
