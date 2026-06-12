import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models';
import { API } from '@core/constants';
import {
  AttendanceDashboardOverview,
  AttendanceDashboardOverviewRaw,
  DashboardWidget,
  Metric,
  toDashboardOverview
} from '../models';

/**
 * HTTP boundary for the dashboard feature.
 *
 * <p>Today the only live endpoint is the attendance overview (BE-6.5);
 * the {@link #metrics}/{@link #widgets} legacy methods are kept as
 * thin placeholders for the future generic dashboard surface, but
 * they are not wired to the page yet.
 */
@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly api = inject(ApiService);

  metrics(): Observable<Metric[]> {
    return this.api.get<Metric[]>(API.DASHBOARD.METRICS);
  }

  widgets(): Observable<DashboardWidget[]> {
    return this.api.get<DashboardWidget[]>(API.DASHBOARD.WIDGETS);
  }

  /**
   * Single-roundtrip snapshot consumed by the admin dashboard
   * (FE-6.4). The endpoint is gated TENANT_ADMIN-only on the server
   * side; teachers must not call this method (the dashboard page
   * branches on role and renders the teacher view instead).
   */
  getAttendanceOverview(): Observable<AttendanceDashboardOverview> {
    return this.api
      .get<ApiResponse<AttendanceDashboardOverviewRaw>>(
        API.ATTENDANCE.DASHBOARD_OVERVIEW
      )
      .pipe(map((envelope) => toDashboardOverview(envelope.data)));
  }
}
