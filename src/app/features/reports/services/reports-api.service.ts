import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { Paginated } from '@core/models';
import { Report, ReportRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly api = inject(ApiService);

  list(): Observable<Paginated<Report>> {
    return this.api.get<Paginated<Report>>(API.REPORTS.ROOT);
  }

  generate(payload: ReportRequest): Observable<Report> {
    return this.api.post<Report>(API.REPORTS.ROOT, payload);
  }

  export(id: string): Observable<{ url: string }> {
    return this.api.post<{ url: string }>(`${API.REPORTS.EXPORT}/${id}`);
  }
}
