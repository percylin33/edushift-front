import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { fromEvent, merge } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { IconComponent } from '@shared/components';
import { ROUTES } from '@core/constants';
import { NotificationsStore } from '@features/notifications/store';

/**
 * Notifications bell in the layout navbar.
 *
 * <h3>State source</h3>
 * Reads {@code unread} directly from the {@link NotificationsStore}
 * singleton, which persists across navigations. Refresh triggers:
 * <ul>
 *   <li>Mount (cold load)</li>
 *   <li>Window {@code focus} / document {@code visibilitychange} → visible
 *       (user returns to the tab)</li>
 * </ul>
 * Navigation no longer hits {@code GET /unread-count} — that was a
 * constant load during the school day. Push via STOMP is the next step
 * (see {@code docs/modules/notifications.md} § Realtime / STOMP FE).
 *
 * <h3>Why a method (not a signal getter) and explicit markForCheck</h3>
 * Earlier versions used a signal ({@code signal&lt;number&gt;}) or a
 * {@code computed} bound to the store. Both worked on
 * {@code /notifications} but disappeared on every other route — the
 * underlying reason is that the home page mounts on
 * {@code /notifications} and drives the only
 * "definitely-triggers-render" path: a synchronous
 * {@code _unreadCount.set(...)} inside a successful
 * {@code loadAll()}. On other routes the bell's
 * {@code refreshUnreadCount()} is the only writer; combined with
 * OnPush, the signal write in the bell was not enough to push a new
 * CD pass to the template.
 *
 * <p>Fix: read the count via a plain getter (so the template always
 * reads the current value on each CD cycle) and call
 * {@code markForCheck} explicitly after every refresh. This works on
 * any Angular version and any CD strategy.</p>
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
      @if (unread > 0) {
        <span
          class="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white"
          data-testid="bell-badge"
        >
          {{ unread > 99 ? '99+' : unread }}
        </span>
      }
    </button>
  `,
})
export class NotificationsBellComponent {
  private readonly router = inject(Router);
  private readonly store = inject(NotificationsStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly route = ROUTES.NOTIFICATIONS.ROOT;

  /** Plain getter reads the store signal on every CD cycle. */
  get unread(): number {
    return this.store.unreadCount();
  }

  constructor() {
    this.refresh();

    // Refresh when the user returns to the tab (not on every route change).
    const win = typeof window !== 'undefined' ? window : null;
    const doc = typeof document !== 'undefined' ? document : null;
    if (win && doc) {
      merge(
        fromEvent(win, 'focus'),
        fromEvent(doc, 'visibilitychange').pipe(
          filter(() => doc.visibilityState === 'visible')
        )
      )
        .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.refresh());
    }
  }

  private refresh(): void {
    this.store
      .refreshUnreadCount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.cdr.markForCheck(),
        error: () => this.cdr.markForCheck(),
      });
  }

  ariaLabel(): string {
    const n = this.unread;
    if (n <= 0) return 'Notificaciones';
    return `Notificaciones (${n} no leídas)`;
  }

  goToNotifications(): void {
    void this.router.navigateByUrl(this.route);
  }
}
