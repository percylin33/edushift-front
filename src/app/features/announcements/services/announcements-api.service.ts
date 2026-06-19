import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { Announcement, CreateAnnouncementPayload } from '../models/announcement.model';

const BASE = '/api/v1/announcements';

/**
 * Announcements REST service (Sprint 9 / FE-9.2).
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementsApiService {
  private readonly api = inject(ApiService);

  list(limit = 20): Observable<Announcement[]> {
    return this.api.get<Announcement[]>(BASE, { limit });
  }

  get(publicUuid: string): Observable<Announcement> {
    return this.api.get<Announcement>(`${BASE}/${publicUuid}`);
  }

  create(payload: CreateAnnouncementPayload): Observable<Announcement> {
    return this.api.post<Announcement>(BASE, payload);
  }

  update(publicUuid: string, payload: CreateAnnouncementPayload): Observable<Announcement> {
    return this.api.patch<Announcement>(`${BASE}/${publicUuid}`, payload);
  }

  publish(publicUuid: string): Observable<Announcement> {
    return this.api.post<Announcement>(`${BASE}/${publicUuid}/publish`);
  }

  markRead(publicUuid: string): Observable<void> {
    return this.api.post<void>(`${BASE}/${publicUuid}/read`);
  }
}
