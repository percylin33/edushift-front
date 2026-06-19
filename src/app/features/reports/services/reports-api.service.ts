import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { CreateReportPayload, ReportJob } from '../models/report.model';

const BASE = '/api/v1/reports';

/**
 * Reports REST service (Sprint 9 / FE-9.3).
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

  downloadUrl(publicUuid: string): string {
    return `${BASE}/${publicUuid}/download`;
  }
}
