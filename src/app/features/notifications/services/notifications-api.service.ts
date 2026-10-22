import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { NotificationItem, NotificationPreferences } from '../models';
import { NotificationPreferenceRow } from '../models/preferences.model';

/**
 * Notifications REST service (Sprint 9 / FE-9.1 + FE-9.4).
 *
 * <p>Extends the Sprint 1 skeleton with the new endpoints added in
 * Sprint 9: {@code /unread-count} for the bell badge, per-item
 * mark-read, and the preferences matrix CRUD.</p>
 *
 * <h3>Envelope contract (Sprint 5C rewire)</h3>
 * All listing endpoints return an {@link ApiResponse} envelope
 * (NOT a bare paginated object) so the interceptor can surface BE
 * errors uniformly. The pagination meta lives in
 * {@code response.meta} and the rows in {@code response.data}.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly api = inject(ApiService);

  /** Full list (used by the home page). Includes both read and unread. */
  list(unreadOnly = false): Observable<ApiResponse<NotificationItem[]>> {
    return this.api.get<ApiResponse<NotificationItem[]>>(API.NOTIFICATIONS.ROOT, {
      unreadOnly,
    });
  }

  /** Lightweight unread count for the bell badge. */
  listUnreadCount(): Observable<ApiResponse<{ unreadCount: number }>> {
    return this.api.get<ApiResponse<{ unreadCount: number }>>(
      API.NOTIFICATIONS.UNREAD_COUNT
    );
  }

  /** Mark a single notification as read (PATCH /{publicUuid}/read). */
  markRead(id: string): Observable<NotificationItem> {
    return this.api.patch<NotificationItem>(API.NOTIFICATIONS.MARK_READ(id));
  }

  /** Bulk mark-all-read (POST /read-all). Returns the count updated. */
  markAllRead(): Observable<{ updated: number } | number | null> {
    return this.api.post<{ updated: number } | number | null>(
      API.NOTIFICATIONS.MARK_ALL_READ
    );
  }

  /** Sprint 9 / FE-9.4 — list the user's preference rows. */
  getPreferences(): Observable<NotificationPreferenceRow[]> {
    return this.api
      .get<ApiResponse<NotificationPreferenceRow[]>>(API.NOTIFICATIONS.PREFERENCES)
      .pipe(map((response) => (Array.isArray(response?.data) ? response.data : [])));
  }

  /** Sprint 9 / FE-9.4 — set a single (channel × category) preference. */
  updatePreference(row: NotificationPreferenceRow): Observable<NotificationPreferenceRow> {
    return this.api.post<NotificationPreferenceRow>(
      API.NOTIFICATIONS.PREFERENCES,
      row
    );
  }

  /** Legacy: bulk update (kept for future "save all" use). */
  updatePreferences(payload: NotificationPreferences): Observable<NotificationPreferences> {
    return this.api.put<NotificationPreferences>(API.NOTIFICATIONS.PREFERENCES, payload);
  }
}
