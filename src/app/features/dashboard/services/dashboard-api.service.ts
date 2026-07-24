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
  TeacherDashboardSnapshot,
  TeacherDashboardSnapshotRaw,
  toDashboardOverview,
  toTeacherDashboardSnapshot,
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
      .get<ApiResponse<AttendanceDashboardOverviewRaw>>(API.ATTENDANCE.DASHBOARD_OVERVIEW)
      .pipe(map((envelope) => toDashboardOverview(envelope.data)));
  }

  /**
   * Teacher attendance dashboard snapshot (Sprint 9B / BE-9B.1).
   *
   * <p>Server-side scoped to the bearer teacher's active
   * assignments. The {@code TEACHER} role has access; {@code
   * TENANT_ADMIN} can also call it (useful for support scenarios).
   * No extra FE filter is required — the backend is authoritative.</p>
   */
  getTeacherDashboard(): Observable<TeacherDashboardSnapshot> {
    return this.api
      .get<ApiResponse<TeacherDashboardSnapshotRaw>>(
        API.DASHBOARD.TEACHER,
      )
      .pipe(map((envelope) => toTeacherDashboardSnapshot(envelope.data)));
  }
}
