import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { NotificationItem, NotificationPreferences } from '../models';

/**
 * Cross-component store for in-app notifications.
 *
 * <h3>Why this store exists</h3>
 * Before this store, the bell badge in the layout and the home page each
 * maintained their own local state — so {@code mark-read} in the home
 * page left the bell badge stale, and navigating between pages forced
 * a full reload to re-sync the count. The store makes the unread count
 * a single source of truth both consumers read from, with three refresh
 * triggers:
 *
 * <ol>
 *   <li>The bell calls {@link refreshUnreadCount} on mount + on every
 *       {@code NavigationEnd}, so the badge stays in sync with whatever
 *       happened in any other page.</li>
 *   <li>The home page calls {@link loadAll} when the user lands on
 *       {@code /notifications}, hydrating the local list and
 *       recomputing the unread count from it.</li>
 *   <li>{@link markRead} / {@link markAllRead} mutate the store
 *       in-memory; both consumers (bell + home) re-evaluate
 *       automatically via Angular's signal graph.</li>
 * </ol>
 *
 * <h3>Why {@code unreadCount} is a signal, not a computed</h3>
 * An earlier draft derived {@code unreadCount} from
 * {@code _items().filter(...).length} — which broke the bell on cold
 * load: the bell calls {@code refreshUnreadCount()} on mount (which
 * fetches the count from the BE), but {@code _items} is still empty
 * until the user lands on {@code /notifications} and the home page
 * triggers {@code loadAll()}. With a computed, the bell badge
 * displayed 0 until the user navigated to the home — exactly the
 * behaviour this comment was written to explain.
 *
 * <p>The fix is to keep {@code unreadCount} as a dedicated signal
 * that {@link refreshUnreadCount} writes to, with
 * {@link markRead} / {@link markAllRead} decrementing it locally so
 * the bell badge updates without waiting for a network round-trip.
 * {@link loadAll} reconciles from {@code items.length} for the case
 * where the home page is the first consumer.</p>
 *
 * <h3>Multi-tenant guarantee</h3>
 * The store never persists to localStorage — the unread count is always
 * derived from the backend on mount/navigation. Tenant switches (via
 * {@code @features/auth}) trigger a {@link reset} in the auth-store
 * observer (out of scope here).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly api = inject(ApiService);

  private readonly _items = signal<NotificationItem[]>([]);
  private readonly _unreadCount = signal(0);
  private readonly _preferences = signal<NotificationPreferences | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly preferences = this._preferences.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Single-source-of-truth for the unread badge in the bell.
   *
   * <p>Written by:
   * <ul>
   *   <li>{@link refreshUnreadCount} — fetches from {@code GET /v1/notifications/unread-count}.</li>
   *   <li>{@link markRead} / {@link markAllRead} — decrement locally so the
   *       bell badge updates without a network round-trip.</li>
   *   <li>{@link loadAll} — recomputes from the hydrated list as a
   *       source-of-truth fallback when the home page hydrates first.</li>
   * </ul>
   * </p>
   */
  readonly unreadCount = this._unreadCount.asReadonly();

  setItems(items: NotificationItem[]): void {
    this._items.set(items);
  }
  setPreferences(preferences: NotificationPreferences | null): void {
    this._preferences.set(preferences);
  }
  setLoading(value: boolean): void {
    this._loading.set(value);
  }
  setError(error: string | null): void {
    this._error.set(error);
  }

  /**
   * Re-fetch the unread count without hydrating the full list. Cheap
   * enough to run on every navigation. Sets {@link unreadCount}
   * <strong>directly</strong> from the server response so the bell
   * badge reflects the truth even before the home page has loaded.
   */
  refreshUnreadCount() {
    return this.api
      .get<ApiResponse<{ unreadCount: number }>>(API.NOTIFICATIONS.UNREAD_COUNT)
      .pipe(
        tap((res) => {
          // Backend returns an ApiResponse envelope: { success, data: { unreadCount }, meta, timestamp }.
          // Reading `res.unreadCount` (raw) instead of `res.data.unreadCount`
          // (envelope) silently always evaluates to 0 — that was the
          // whole reason the bell badge never showed. See sprint 5C
          // closure docs for the post-mortem.
          const serverCount = res?.data?.unreadCount ?? 0;
          this._unreadCount.set(serverCount);

          // Reconcile the cached list: if the server says fewer unread
          // than what the list shows, the user marked something as read
          // in another tab/device — trim the oldest readAt=null items
          // until both counts match. This keeps the home page consistent
          // with the bell badge if the user navigates back here later.
          const cached = this._items();
          const localUnread = cached.filter(
            (n) => !n.readAt && n.status !== 'READ'
          ).length;
          if (localUnread > serverCount) {
            const sorted = [...cached].sort((a, b) =>
              a.sentAt.localeCompare(b.sentAt)
            );
            let remaining = serverCount;
            this._items.set(
              sorted.map((n) => {
                if (!n.readAt && n.status !== 'READ' && remaining <= 0) {
                  return {
                    ...n,
                    status: 'READ' as const,
                    readAt: new Date().toISOString(),
                  };
                }
                if (!n.readAt && n.status !== 'READ') remaining--;
                return n;
              })
            );
          }
        }),
        catchError(() => {
          // Keep the previous value on transient failure — the next
          // navigation or home-page load will re-sync.
          return of({
            success: true,
            data: { unreadCount: this._unreadCount() },
            timestamp: new Date().toISOString(),
          });
        })
      );
  }

  /**
   * Load the full list and recompute the unread count from it. Used
   * by the home page on entry. After this call, the bell and the
   * home page share the same in-memory list.
   */
  loadAll() {
    this._loading.set(true);
    this._error.set(null);
    // FIX BUG-2026-07-30-08: backend controller signature is
    // `list(@RequestParam boolean unreadOnly, Pageable pageable)`.
    // Without `page`/`size` Spring's `PageableHandlerMethodArgumentResolver`
    // throws (and the FE was getting "No se pudieron cargar las
    // notificaciones"). Pass pagination explicitly so the resolver
    // always has a non-null page request.
    return this.api
      .get<ApiResponse<NotificationItem[]>>(API.NOTIFICATIONS.ROOT, {
        unreadOnly: false,
        page: 0,
        size: 20,
      })
      .pipe(
        tap({
          next: (res) => {
            this._loading.set(false);
            if (res?.success && Array.isArray(res.data)) {
              this._items.set(res.data);
              // Re-derive the unread count from the hydrated list so the
              // bell badge matches the rendered rows.
              const unread = res.data.filter(
                (n) => !n.readAt && n.status !== 'READ'
              ).length;
              this._unreadCount.set(unread);
            }
          },
          error: (err) => {
            this._loading.set(false);
            this._error.set(err?.message ?? 'load failed');
          },
        })
      );
  }

  /**
   * Mark one row as read. Updates {@link unreadCount} immediately
   * (decrement by 1) so the bell badge re-evaluates without waiting
   * for the network round-trip. The HTTP PATCH still runs; on failure
   * the local mutation is reverted by the caller (or by this method
   * itself if the patch fails — see below).
   */
  markRead(publicUuid: string) {
    const previousItems = this._items();
    const previousCount = this._unreadCount();

    const target = previousItems.find((n) => n.publicUuid === publicUuid);
    const wasUnread = target && !target.readAt && target.status !== 'READ';

    // Optimistic update.
    this._items.update((list) =>
      list.map((n) =>
        n.publicUuid === publicUuid
          ? { ...n, status: 'READ' as const, readAt: new Date().toISOString() }
          : n
      )
    );
    if (wasUnread) {
      this._unreadCount.set(Math.max(0, previousCount - 1));
    }

    return this.api
      .patch<NotificationItem>(API.NOTIFICATIONS.MARK_READ(publicUuid))
      .pipe(
        catchError(() => {
          // Revert on failure.
          this._items.set(previousItems);
          this._unreadCount.set(previousCount);
          return of(null);
        })
      );
  }

  markAllRead(): void {
    const now = new Date().toISOString();
    this._items.update((list) =>
      list.map((n) => (n.readAt ? n : { ...n, status: 'READ' as const, readAt: now }))
    );
    this._unreadCount.set(0);
  }

  reset(): void {
    this._items.set([]);
    this._unreadCount.set(0);
    this._preferences.set(null);
    this._loading.set(false);
    this._error.set(null);
  }
}
