import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { Paginated } from '@core/models';
import { NotificationItem, NotificationPreferences } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly api = inject(ApiService);

  list(unreadOnly = false): Observable<Paginated<NotificationItem>> {
    return this.api.get<Paginated<NotificationItem>>(API.NOTIFICATIONS.ROOT, { unreadOnly });
  }

  markRead(id: string): Observable<NotificationItem> {
    return this.api.patch<NotificationItem>(`${API.NOTIFICATIONS.ROOT}/${id}/read`);
  }

  markAllRead(): Observable<void> {
    return this.api.post<void>(`${API.NOTIFICATIONS.ROOT}/read-all`);
  }

  getPreferences(): Observable<NotificationPreferences> {
    return this.api.get<NotificationPreferences>(API.NOTIFICATIONS.PREFERENCES);
  }

  updatePreferences(payload: NotificationPreferences): Observable<NotificationPreferences> {
    return this.api.put<NotificationPreferences>(API.NOTIFICATIONS.PREFERENCES, payload);
  }
}
