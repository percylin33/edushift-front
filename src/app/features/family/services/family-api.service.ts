import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, SpringPage } from '@core/models/api-response.model';
import { FamilyActivityItem, FamilyPaymentItem } from '../models/family-activity.model';
import { FamilyAttendanceRecord, FamilyAttendanceRecordRaw, toFamilyAttendanceRecord } from '../models/family-attendance.model';
import { FamilyChildSummary } from '../models/family-child.model';
import { FamilyGradeItem, FamilyGradeItemRaw, toFamilyGradeItem } from '../models/family-grade.model';
import { ScheduleWeekView, ScheduleWeekViewRaw, toScheduleWeekView } from '@features/academic/models';
import { map } from 'rxjs/operators';

export type { FamilyChildSummary } from '../models/family-child.model';

@Injectable({ providedIn: 'root' })
export class FamilyApiService {
  private readonly http = inject(HttpClient);

  listChildren(): Observable<ApiResponse<FamilyChildSummary[]>> {
    return this.http.get<ApiResponse<FamilyChildSummary[]>>('/api/v1/family/children');
  }

  getChildAttendance(
    studentPublicUuid: string,
    params: { page?: number; size?: number } = {},
  ): Observable<SpringPage<FamilyAttendanceRecordRaw>> {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.size !== undefined) query.set('size', String(params.size));
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return this.http.get<SpringPage<FamilyAttendanceRecordRaw>>(
      `/api/v1/family/children/${studentPublicUuid}/attendance${suffix}`,
    );
  }

  getChildGrades(studentPublicUuid: string): Observable<ApiResponse<FamilyGradeItemRaw[]>> {
    return this.http.get<ApiResponse<FamilyGradeItemRaw[]>>(
      `/api/v1/family/children/${studentPublicUuid}/grades`,
    );
  }

  getChildActivities(studentPublicUuid: string): Observable<ApiResponse<FamilyActivityItem[]>> {
    return this.http.get<ApiResponse<FamilyActivityItem[]>>(
      `/api/v1/family/children/${studentPublicUuid}/activities`,
    );
  }

  getChildPayments(studentPublicUuid: string): Observable<ApiResponse<FamilyPaymentItem[]>> {
    return this.http.get<ApiResponse<FamilyPaymentItem[]>>(
      `/api/v1/family/children/${studentPublicUuid}/payments`,
    );
  }

  getChildSchedule(studentPublicUuid: string): Observable<ApiResponse<ScheduleWeekView>> {
    return this.http
      .get<ApiResponse<ScheduleWeekViewRaw>>(
        `/api/v1/family/children/${studentPublicUuid}/schedule`,
      )
      .pipe(
        map((response) => ({
          ...response,
          data: toScheduleWeekView(response.data),
        })),
      );
  }

  justifyAttendance(
    recordPublicUuid: string,
    justificationText: string,
    attachmentPublicUuid?: string | null,
  ): Observable<unknown> {
    return this.http.post(`/api/v1/attendance/records/${recordPublicUuid}/justify`, {
      justificationText,
      attachmentPublicUuid: attachmentPublicUuid ?? null,
    });
  }

  adaptAttendancePage(page: SpringPage<FamilyAttendanceRecordRaw>): SpringPage<FamilyAttendanceRecord> {
    return {
      ...page,
      content: page.content.map(toFamilyAttendanceRecord),
    };
  }

  adaptGrades(items: FamilyGradeItemRaw[]): FamilyGradeItem[] {
    return items.map(toFamilyGradeItem);
  }
}
