import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models';
import {
  Announcement,
  AnnouncementStatus,
  AudiencePreview,
  CreateAnnouncementPayload,
  TeachingScope,
} from '../models/announcement.model';

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

  listAdmin(status?: AnnouncementStatus, page = 0, size = 50): Observable<Announcement[]> {
    const params: Record<string, string | number> = { page, size };
    if (status) params['status'] = status;
    return this.api
      .get<ApiResponse<Announcement[]>>(`${BASE}/admin`, params)
      .pipe(map((env) => env.data ?? []));
  }

  preview(payload: CreateAnnouncementPayload): Observable<AudiencePreview> {
    return this.api
      .post<ApiResponse<AudiencePreview>, CreateAnnouncementPayload>(`${BASE}/preview-audience`, payload)
      .pipe(map((env) => env.data));
  }

  teachingScope(): Observable<TeachingScope> {
    return this.api
      .get<ApiResponse<TeachingScope>>(`${BASE}/teaching-scope`)
      .pipe(map((env) => env.data));
  }

  archive(publicUuid: string): Observable<Announcement> {
    return this.api
      .post<ApiResponse<Announcement>>(`${BASE}/${publicUuid}/archive`)
      .pipe(map((env) => env.data));
  }

  remove(publicUuid: string): Observable<void> {
    return this.api.delete<ApiResponse<null>>(`${BASE}/${publicUuid}`).pipe(map(() => undefined));
  }
}
