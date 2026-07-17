import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';

import { ApiService } from '@core/services';
import {
  BugReport,
  CreateBugReportRequest,
  PagedBugReports,
} from '../models/qa.model';

interface ApiResponseEnvelope<T> {
  success: boolean;
  data: T;
}

interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * CRUD wrapper for QA bug reports — backs both the wizard's "Reportar bug"
 * modal and the {@code /help/reports} page.
 *
 * <p>The endpoints live under {@code /api/v1/qa/bug-reports} and follow
 * the standard {@code ApiResponse} envelope. Tenant isolation is enforced
 * server-side from the authenticated session.</p>
 */
@Injectable({ providedIn: 'root' })
export class QaBugReportService {
  private readonly api = inject(ApiService);

  private readonly baseUrl = `${environment.apiUrl}/${environment.apiVersion}/qa/bug-reports`;

  create(body: CreateBugReportRequest): Observable<BugReport> {
    return this.api
      .post<ApiResponseEnvelope<BugReport>, CreateBugReportRequest>(this.baseUrl, body)
      .pipe(map((res) => res.data));
  }

  list(
    opts: { capabilityId?: string; status?: string; page?: number; size?: number } = {},
  ): Observable<PagedBugReports> {
    const params: Record<string, string | number> = {};
    if (opts.capabilityId) params['capabilityId'] = opts.capabilityId;
    if (opts.status) params['status'] = opts.status;
    if (opts.page != null) params['page'] = opts.page;
    if (opts.size != null) params['size'] = opts.size;
    return this.api
      .get<ApiResponseEnvelope<PagedResponse<BugReport>>>(this.baseUrl, params)
      .pipe(
        map((res) => ({
          content: res.data.content,
          totalElements: res.data.totalElements,
          totalPages: res.data.totalPages,
          number: res.data.number,
          size: res.data.size,
        })),
      );
  }

  updateStatus(
    publicUuid: string,
    status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED',
  ): Observable<BugReport> {
    return this.api
      .patch<ApiResponseEnvelope<BugReport>, { status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' }>(
        `${this.baseUrl}/${publicUuid}/status`,
        { status },
      )
      .pipe(map((res) => res.data));
  }
}
