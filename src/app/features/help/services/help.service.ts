import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '@env/environment';
import { ApiResponse } from '@core/models';

import {
  CreateFeedbackRequest,
  HelpFeedback,
  HelpProgressItem,
  ManualChapter,
  ManualIndexEntry,
  SetProgressRequest,
} from '../models/help.model';

/**
 * HTTP boundary for the public help endpoints.
 *
 * <h3>Why a dedicated service</h3>
 * The endpoints (`/v1/help/manuals` and `/v1/help/manuals/{role}/{file}`)
 * are public — no `X-Tenant-Slug`, no bearer token — so we don't go
 * through `ApiService` which always attaches the tenant interceptor.
 * Calling `HttpClient.get` directly keeps the requests slim and lets us
 * add caching at the service layer if/when the manual set grows.
 */
@Injectable({ providedIn: 'root' })
export class HelpService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = `${environment.apiUrl}/${environment.apiVersion}/help/manuals`;

  /**
   * Fetch the list of available manuals.
   * Public endpoint — works without a session.
   */
  list(): Observable<ManualIndexEntry[]> {
    return this.http
      .get<ApiResponse<ManualIndexEntry[]>>(`${this.baseUrl}`)
      .pipe(map((res) => res.data ?? []));
  }

  /**
   * Fetch one chapter (README or 01..03) of a role's manual.
   * Returns the raw markdown source ready to be rendered.
   */
  chapter(role: string, file: string): Observable<ManualChapter> {
    return this.http
      .get<ApiResponse<ManualChapter>>(`${this.baseUrl}/${encodeURIComponent(role)}/${encodeURIComponent(file)}`)
      .pipe(map((res) => res.data));
  }

  // ---------------------------------------------------------------------------
  // Progress (authenticated)
  // ---------------------------------------------------------------------------

  /**
   * Fetch the current user's checklist state for a chapter.
   * Returns `[]` if the user has never marked anything.
   */
  getProgress(role: string, file: string): Observable<HelpProgressItem[]> {
    return this.http
      .get<ApiResponse<HelpProgressItem[]>>(`${environment.apiUrl}/${environment.apiVersion}/help/progress/${encodeURIComponent(role)}/${encodeURIComponent(file)}`)
      .pipe(map((res) => res.data ?? []));
  }

  /**
   * Upsert one item's checked state. Returns the persisted row.
   */
  setProgress(
    role: string,
    file: string,
    itemId: string,
    checked: boolean,
  ): Observable<HelpProgressItem> {
    const body: SetProgressRequest = { itemId, checked };
    return this.http
      .put<ApiResponse<HelpProgressItem>>(
        `${environment.apiUrl}/${environment.apiVersion}/help/progress/${encodeURIComponent(role)}/${encodeURIComponent(file)}`,
        body,
      )
      .pipe(map((res) => res.data));
  }

  /**
   * Remove one item's row (returns it to "unchecked / not set").
   */
  clearProgress(role: string, file: string, itemId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<unknown>>(
        `${environment.apiUrl}/${environment.apiVersion}/help/progress/${encodeURIComponent(role)}/${encodeURIComponent(file)}/${encodeURIComponent(itemId)}`,
      )
      .pipe(map(() => undefined));
  }

  // ---------------------------------------------------------------------------
  // Feedback (authenticated)
  // ---------------------------------------------------------------------------

  /** Submit feedback for a chapter (or for the manual as a whole). */
  postFeedback(req: CreateFeedbackRequest): Observable<HelpFeedback> {
    return this.http
      .post<ApiResponse<HelpFeedback>>(
        `${environment.apiUrl}/${environment.apiVersion}/help/feedback`,
        req,
      )
      .pipe(map((res) => res.data));
  }

  /** List my feedback for one role, newest first. */
  listMyFeedback(role: string): Observable<HelpFeedback[]> {
    return this.http
      .get<ApiResponse<HelpFeedback[]>>(`${environment.apiUrl}/${environment.apiVersion}/help/feedback/${encodeURIComponent(role)}`)
      .pipe(map((res) => res.data ?? []));
  }
}