import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { CreateReportPayload, ReportJob } from '../models/report.model';

const BASE = '/api/v1/reports';

/**
 * Reports REST service (Sprint 9 / FE-9.3 + Sprint cierre-C / F12 catalog).
 *
 * <p>The list endpoint (added in F12) is the same
 * {@code GET /v1/reports} that the BE serves today (Sprint 9 / BE-9.2
 * — admin can browse every job in the tenant; the FE shows it as the
 * "Report catalog" view).</p>
 */
@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly api = inject(ApiService);

  create(payload: CreateReportPayload): Observable<ReportJob> {
    return this.api.post<ReportJob>(BASE, payload);
  }

  get(publicUuid: string): Observable<ReportJob> {
    return this.api.get<ReportJob>(`${BASE}/${publicUuid}`);
  }

  /** Sprint cierre-C / F12 — paginated list of all jobs in the tenant. */
  list(page = 0, size = 30): Observable<readonly ReportJob[]> {
    return this.api
      .get<{ data?: ReportJob[] } | ReportJob[]>(BASE, { page, size })
      .pipe(
        map((env) => {
          if (Array.isArray(env)) return env as ReportJob[];
          const data = (env as { data?: ReportJob[] }).data;
          return Array.isArray(data) ? data : [];
        }),
      );
  }

  downloadUrl(publicUuid: string): string {
    return `${BASE}/${publicUuid}/download`;
  }
}
