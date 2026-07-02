import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NotificationsApiService } from '../../services/notifications-api.service';
import { NotificationItem } from '../../models/notification.model';
import { RealtimeService } from '@core/realtime/realtime.service';
import { AuthService } from '@core/services/auth.service';

/**
 * Notification bell + dropdown (Sprint 9 / FE-9.1, Sprint 10 / FE-10.2).
 *
 * <p>Mounted in the top bar (toolbar). Shows the unread count and
 * the last 5 notifications in a dropdown. Marks a notification as
 * read on click.</p>
 *
 * <h3>Sprint 10 / FE-10.2 — realtime push</h3>
 * The 30s polling from Sprint 9 is replaced by a STOMP subscription
 * to {@code /topic/tenant/{id}/user/{uuid}}. On every message the
 * bell badge increments instantly and the dropdown (if open) shows
 * the new row. The initial unread count is fetched via REST on
 * mount; subsequent updates come from the socket.</p>
 *
 * <h3>Empty / loading / error states</h3>
 * - Empty: "No tienes notificaciones" with a check icon.
 * - Loading: 3 skeleton rows.
 * - Error: socket reconnect is automatic; we never block the UI.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <button
        type="button"
        class="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-300 dark:hover:bg-slate-800"
        [attr.aria-label]="'Notificaciones (' + unreadCount() + ' no leídas)'"
        [attr.aria-expanded]="open()"
        (click)="toggle()"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        @if (unreadCount() > 0) {
          <span
            class="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white"
          >
            {{ unreadCount() > 99 ? '99+' : unreadCount() }}
          </span>
        }
        <!-- Sprint 10: tiny dot when socket is disconnected (we're
             falling back to polling — actually we just show stale). -->
        @if (!realtime.connected() && !hideRealtimeDot()) {
          <span
            class="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900"
            title="Realtime desconectado — recargando al volver"
          ></span>
        }
      </button>

      @if (open()) {
        <div
          class="absolute right-0 z-30 mt-2 w-80 rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 sm:w-96"
        >
          <div
            class="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800"
          >
            <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Notificaciones</h3>
            <button
              type="button"
              class="text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
              [disabled]="unreadCount() === 0"
              (click)="markAllRead()"
            >
              Marcar todo leído
            </button>
          </div>

          <div class="max-h-96 overflow-y-auto">
            @if (loading() && items().length === 0) {
              <div class="space-y-3 p-4">
                @for (i of [1, 2, 3]; track i) {
                  <div class="flex animate-pulse items-start gap-3">
                    <div class="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                    <div class="flex-1 space-y-2">
                      <div class="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
                      <div class="h-2 w-1/2 rounded bg-slate-200 dark:bg-slate-700"></div>
                    </div>
                  </div>
                }
              </div>
            } @else if (items().length === 0) {
              <div class="px-4 py-12 text-center">
                <div
                  class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30"
                >
                  <svg
                    class="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  No tienes notificaciones
                </p>
              </div>
            } @else {
              <ul class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (n of items(); track n.id) {
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                      [class.bg-emerald-50]="!n.readAt"
                      [class.dark:bg-emerald-900/20]="!n.readAt"
                      (click)="onItemClick(n)"
                    >
                      <span
                        class="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                        [class.bg-emerald-500]="!n.readAt"
                        [class.bg-slate-300]="!!n.readAt"
                      ></span>
                      <div class="min-w-0 flex-1">
                        <p
                          class="line-clamp-1 text-sm font-medium text-slate-900 dark:text-slate-100"
                        >
                          {{ n.title }}
                        </p>
                        <p class="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                          {{ n.body }}
                        </p>
                        <p
                          class="mt-1 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500"
                        >
                          {{ n.createdAt | date: 'short' }}
                        </p>
                      </div>
                    </button>
                  </li>
                }
              </ul>
            }
          </div>

          <div class="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
            <a
              routerLink="/notifications"
              class="block text-center text-xs text-emerald-600 hover:text-emerald-700"
              (click)="open.set(false)"
            >
              Ver todas las notificaciones
            </a>
          </div>
        </div>
      }
    </div>
  `,
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  private readonly api = inject(NotificationsApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = signal(false);
  readonly items = signal<NotificationItem[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);
  readonly hideRealtimeDot = signal(false);

  readonly hasUnread = computed(() => this.unreadCount() > 0);

  private stop$ = new Subject<void>();

  ngOnInit(): void {
    // 1) Initial fetch of unread count.
    this.api.listUnreadCount().subscribe({
      next: (res) => this.unreadCount.set(res.unreadCount ?? 0),
      error: () => {
        /* keep 0 */
      },
    });

    // 2) Connect to STOMP and subscribe to the per-user topic.
    this.realtime.connect();
    this.auth.user$.pipe(takeUntil(this.stop$)).subscribe((u) => {
      if (u?.tenantId && u?.id) {
        const dest = `/topic/tenant/${u.tenantId}/user/${u.id}`;
        this.realtime.subscribe(dest);
      }
    });
    this.realtime.incoming$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => this.onRealtime(p));
  }

  ngOnDestroy(): void {
    this.stop$.next();
    this.stop$.complete();
  }

  private onRealtime(p: {
    notificationUuid: string;
    subject: string | null;
    templateKey: string;
    category: string;
    occurredAt: string;
  }): void {
    // 1) Bump the unread count.
    this.unreadCount.update((c) => c + 1);
    // 2) If the dropdown is open, prepend a synthetic item.
    if (this.open()) {
      this.items.update((list) =>
        [
          {
            id: p.notificationUuid,
            title: p.subject ?? humanize(p.templateKey),
            body: 'Nueva notificación',
            createdAt: p.occurredAt,
            readAt: null,
          },
          ...list,
        ].slice(0, 10),
      );
    }
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open() && this.items().length === 0) {
      this.loadItems();
    }
  }

  loadItems(): void {
    this.loading.set(true);
    this.api.list(false).subscribe({
      next: (page) => {
        this.items.set(page?.items ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onItemClick(n: NotificationItem): void {
    if (!n.readAt) {
      this.api.markRead(n.id).subscribe(() => {
        this.items.update((list) =>
          list.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
        );
        this.unreadCount.update((c) => Math.max(0, c - 1));
      });
    }
    this.open.set(false);
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe(() => {
      const now = new Date().toISOString();
      this.items.update((list) => list.map((x) => (x.readAt ? x : { ...x, readAt: now })));
      this.unreadCount.set(0);
    });
  }
}

function humanize(key: string): string {
  return key
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
