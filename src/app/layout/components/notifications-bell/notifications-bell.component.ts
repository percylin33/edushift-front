import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IconComponent } from '@shared/components';
import { ROUTES } from '@core/constants';
import { NotificationsStore } from '@features/notifications/store';

/**
 * Notifications bell in the layout navbar.
 *
 * <h3>State source</h3>
 * Reads {@code unread} directly from the {@link NotificationsStore}
 * singleton, which persists across navigations. On every
 * {@code NavigationEnd} we re-fetch the count from the server and call
 * {@link ChangeDetectorRef.markForCheck} so the OnPush template
 * definitely re-renders.
 *
 * <h3>Why a method (not a signal getter) and explicit markForCheck</h3>
 * Earlier versions used a signal ({@code signal<number>}) or a
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
 * {@code markForCheck} explicitly after every refresh and every
 * navigation. This works on any Angular version and any CD
 * strategy.</p>
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
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        // Force a re-render before the fetch even lands. This makes
        // the badge survive navigations even if the next fetch
        // takes a few hundred ms.
        this.cdr.markForCheck();
        this.refresh();
      });
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
