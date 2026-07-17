import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { IconComponent } from '@shared/components';
import { ROUTES } from '@core/constants';
import { NotificationsApiService } from '@features/notifications/services/notifications-api.service';

/**
 * Notifications bell in the layout navbar.
 *
 * <p>The full-featured bell (badge + dropdown + STOMP subscription) lives at
 * {@code @features/notifications/components/notification-bell}. The real
 * component is what the navbar wants, but the layout module deliberately
 * keeps its dependency graph small — pulling in STOMP, the realtime
 * service and the notifications feature store from a layout primitive would
 * cause circular imports and bloat the initial bundle.</p>
 *
 * <p>This stub renders a button with an accessible name, fetches the unread
 * count once on mount (so the badge appears), and navigates to the
 * notifications home on click. The dropdown live-updates live in the
 * feature bell, which is mounted on the notifications home page.</p>
 */
@Component({
  selector: 'app-notifications-bell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-content-muted hover:bg-surface-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-expanded]="false"
      title="Notificaciones"
      (click)="goToNotifications()"
    >
      <app-icon name="bell" [size]="18" />
      @if (unreadCount() > 0) {
        <span
          class="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white"
        >
          {{ unreadCount() > 99 ? '99+' : unreadCount() }}
        </span>
      }
    </button>
  `,
})
export class NotificationsBellComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly api = inject(NotificationsApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly route = ROUTES.NOTIFICATIONS.ROOT;
  readonly unreadCount = signal(0);

  ngOnInit(): void {
    this.api
      .listUnreadCount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.unreadCount.set(res.unreadCount ?? 0),
        error: () => {
          /* keep 0 */
        },
      });
  }

  ariaLabel(): string {
    const n = this.unreadCount();
    if (n <= 0) return 'Notificaciones';
    return `Notificaciones (${n} no leídas)`;
  }

  goToNotifications(): void {
    void this.router.navigateByUrl(this.route);
  }
}

// Angular strict-mode standalone components need an explicit `inject` import.
// (kept as a no-op marker — `inject` is already imported above.)
