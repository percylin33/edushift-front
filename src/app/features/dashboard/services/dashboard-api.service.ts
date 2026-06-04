import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { DashboardWidget, Metric } from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly api = inject(ApiService);

  metrics(): Observable<Metric[]> {
    return this.api.get<Metric[]>(API.DASHBOARD.METRICS);
  }

  widgets(): Observable<DashboardWidget[]> {
    return this.api.get<DashboardWidget[]>(API.DASHBOARD.WIDGETS);
  }
}
