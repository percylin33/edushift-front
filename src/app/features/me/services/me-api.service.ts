import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MeGrade } from '../models/me-grade.model';
import { MeProfile } from '../models/me-profile.model';
import { MeSection, MeSectionDetail, MeSectionPeriod } from '../models/me-section.model';
import { MeAttendanceRecord } from '../models/me-attendance.model';
import { MeInvoice } from '../models/me-invoice.model';
import { MeQr } from '../models/me-qr.model';
import { ScheduleWeekView, ScheduleWeekViewRaw, toScheduleWeekView } from '@features/academic/models';
import { map } from 'rxjs/operators';

interface ApiResponse<T> {
  data: T;
}

/**
 * STUDENT-facing API surface for `/me/*`.
 * Every call is JWT-only — never pass `studentPublicUuid`.
 */
@Injectable({ providedIn: 'root' })
export class MeApiService {
  private readonly http = inject(HttpClient);

  getProfile(): Observable<ApiResponse<MeProfile>> {
    return this.http.get<ApiResponse<MeProfile>>('/api/v1/me/profile');
  }

  listSections(periodPublicUuid?: string | null): Observable<ApiResponse<MeSection[]>> {
    const params: Record<string, string> = {};
    if (periodPublicUuid) {
      params['period'] = periodPublicUuid;
    }
    return this.http.get<ApiResponse<MeSection[]>>('/api/v1/me/sections', { params });
  }

  listSectionPeriods(): Observable<ApiResponse<MeSectionPeriod[]>> {
    return this.http.get<ApiResponse<MeSectionPeriod[]>>('/api/v1/me/sections/periods');
  }

  getSection(
    sectionPublicUuid: string,
    assignmentPublicUuid?: string | null,
  ): Observable<ApiResponse<MeSectionDetail>> {
    const params: Record<string, string> = {};
    if (assignmentPublicUuid) {
      params['assignment'] = assignmentPublicUuid;
    }
    return this.http.get<ApiResponse<MeSectionDetail>>(
      `/api/v1/me/sections/${sectionPublicUuid}`,
      { params },
    );
  }

  listGrades(): Observable<ApiResponse<MeGrade[]>> {
    return this.http.get<ApiResponse<MeGrade[]>>('/api/v1/me/grades');
  }

  listAttendance(params?: { from?: string; to?: string }): Observable<ApiResponse<MeAttendanceRecord[]>> {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return this.http.get<ApiResponse<MeAttendanceRecord[]>>(`/api/v1/me/attendance${suffix}`);
  }

  getQr(): Observable<ApiResponse<MeQr>> {
    return this.http.get<ApiResponse<MeQr>>('/api/v1/me/qr');
  }

  revealQr(): Observable<ApiResponse<MeQr>> {
    return this.http.post<ApiResponse<MeQr>>('/api/v1/me/qr/reveal', {});
  }

  listPayments(): Observable<ApiResponse<MeInvoice[]>> {
    return this.http.get<ApiResponse<MeInvoice[]>>('/api/v1/me/payments');
  }

  listSchedule(): Observable<ApiResponse<ScheduleWeekView>> {
    return this.http.get<ApiResponse<ScheduleWeekViewRaw>>('/api/v1/me/schedule').pipe(
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
}
