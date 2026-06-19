import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { Paginated } from '@core/models';
import { NotificationItem, NotificationPreferences } from '../models';
import { NotificationPreferenceRow } from '../models/preferences.model';

/**
 * Notifications REST service (Sprint 9 / FE-9.1 + FE-9.4).
 *
 * <p>Extends the Sprint 1 skeleton with the new endpoints added in
 * Sprint 9: {@code /unread-count} for the bell badge, per-item
 * mark-read, and the preferences matrix CRUD.</p>
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly api = inject(ApiService);

  /** Lightweight list (used by the bell dropdown). */
  list(unreadOnly = false): Observable<Paginated<NotificationItem>> {
    return this.api.get<Paginated<NotificationItem>>(API.NOTIFICATIONS.ROOT, { unreadOnly });
  }

  /** Lightweight unread count for the bell badge. */
  listUnreadCount(): Observable<{ unreadCount: number }> {
    return this.api.get<{ unreadCount: number }>(API.NOTIFICATIONS.UNREAD_COUNT);
  }

  /** Mark a single notification as read (PATCH /{publicUuid}/read). */
  markRead(id: string): Observable<NotificationItem> {
    return this.api.patch<NotificationItem>(API.NOTIFICATIONS.MARK_READ(id));
  }

  /** Bulk mark-all-read (POST /read-all). Returns the count updated. */
  markAllRead(): Observable<{ updated: number } | number | null> {
    return this.api.post<{ updated: number } | number | null>(
      API.NOTIFICATIONS.MARK_ALL_READ);
  }

  /** Sprint 9 / FE-9.4 — list the user's preference rows. */
  getPreferences(): Observable<NotificationPreferenceRow[]> {
    return this.api.get<NotificationPreferenceRow[]>(API.NOTIFICATIONS.PREFERENCES);
  }

  /** Sprint 9 / FE-9.4 — set a single (channel × category) preference. */
  updatePreference(row: NotificationPreferenceRow): Observable<NotificationPreferenceRow> {
    return this.api.post<NotificationPreferenceRow>(API.NOTIFICATIONS.PREFERENCES, row);
  }

  /** Legacy: bulk update (kept for future "save all" use). */
  updatePreferences(payload: NotificationPreferences): Observable<NotificationPreferences> {
    return this.api.put<NotificationPreferences>(API.NOTIFICATIONS.PREFERENCES, payload);
  }
}
