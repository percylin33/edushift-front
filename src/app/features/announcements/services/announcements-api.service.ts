import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models';
import { Announcement, CreateAnnouncementPayload } from '../models/announcement.model';

const BASE = '/api/v1/announcements';

/**
 * Announcements REST service (Sprint 9 / FE-9.2).
 *
 * <p>Unwraps the standard {@link ApiResponse} envelope so callers receive
 * the domain object (same pattern as attendance / classrooms APIs).</p>
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementsApiService {
  private readonly api = inject(ApiService);

  list(limit = 20): Observable<Announcement[]> {
    return this.api
      .get<ApiResponse<Announcement[]>>(BASE, { limit })
      .pipe(map((env) => env.data ?? []));
  }

  get(publicUuid: string): Observable<Announcement> {
    return this.api
      .get<ApiResponse<Announcement>>(`${BASE}/${publicUuid}`)
      .pipe(map((env) => env.data));
  }

  create(payload: CreateAnnouncementPayload): Observable<Announcement> {
    return this.api
      .post<ApiResponse<Announcement>, CreateAnnouncementPayload>(BASE, payload)
      .pipe(map((env) => env.data));
  }

  update(publicUuid: string, payload: CreateAnnouncementPayload): Observable<Announcement> {
    return this.api
      .patch<ApiResponse<Announcement>, CreateAnnouncementPayload>(
        `${BASE}/${publicUuid}`,
        payload,
      )
      .pipe(map((env) => env.data));
  }

  publish(publicUuid: string): Observable<Announcement> {
    return this.api
      .post<ApiResponse<Announcement>>(`${BASE}/${publicUuid}/publish`)
      .pipe(map((env) => env.data));
  }

  markRead(publicUuid: string): Observable<void> {
    return this.api.post<ApiResponse<null>>(`${BASE}/${publicUuid}/read`).pipe(map(() => undefined));
  }
}
