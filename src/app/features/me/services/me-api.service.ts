import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MeGrade } from '../models/me-grade.model';
import { MeProfile } from '../models/me-profile.model';
import { MeSection, MeSectionDetail } from '../models/me-section.model';
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

  listSections(): Observable<ApiResponse<MeSection[]>> {
    return this.http.get<ApiResponse<MeSection[]>>('/api/v1/me/sections');
  }

  getSection(sectionPublicUuid: string): Observable<ApiResponse<MeSectionDetail>> {
    return this.http.get<ApiResponse<MeSectionDetail>>(
      `/api/v1/me/sections/${sectionPublicUuid}`,
    );
  }

  listGrades(): Observable<ApiResponse<MeGrade[]>> {
    return this.http.get<ApiResponse<MeGrade[]>>('/api/v1/me/grades');
  }

  listAttendance(): Observable<ApiResponse<MeAttendanceRecord[]>> {
    return this.http.get<ApiResponse<MeAttendanceRecord[]>>('/api/v1/me/attendance');
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
