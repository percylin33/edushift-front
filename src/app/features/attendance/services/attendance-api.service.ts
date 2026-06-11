import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  AttendanceQrInfo,
  AttendanceQrInfoResponseRaw,
  AttendanceRecord,
  AttendanceRecordResponseRaw,
  AttendanceSession,
  AttendanceSessionResponseRaw,
  CheckInRequest,
  CreateSessionRequest,
  UpdateRecordRequest
} from '../models';

/**
 * HTTP boundary for the {@code attendance} module
 * ({@code /api/v1/attendance}) and the student-attendance-QR sub-resource
 * ({@code /api/v1/students/{uuid}/attendance-qr}) — both live here because
 * they share the same `tenant_id` propagation and the same scan flow
 * from the teacher's POV.
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #openSession}   → {@code POST  /v1/attendance/sessions}</li>
 *   <li>{@link #closeSession}  → {@code PATCH /v1/attendance/sessions/{uuid}/close}</li>
 *   <li>{@link #checkIn}       → {@code POST  /v1/attendance/sessions/{uuid}/check-in}</li>
 *   <li>{@link #listRecords}   → {@code GET   /v1/attendance/sessions/{uuid}/records}</li>
 *   <li>{@link #updateRecord}  → {@code PUT   /v1/attendance/records/{uuid}}</li>
 *   <li>{@link #downloadQr}    → {@code GET   /v1/students/{uuid}/attendance-qr} (binary)</li>
 *   <li>{@link #getQrInfo}     → {@code GET   /v1/students/{uuid}/attendance-qr/info}</li>
 *   <li>{@link #rotateQr}      → {@code POST  /v1/students/{uuid}/attendance-qr/rotate}</li>
 * </ul>
 *
 * <h3>Why adapters narrow ISO strings → Date</h3>
 * The UI is constantly formatting `occurredAt` and `startsAt`. Doing
 * `new Date(raw.startsAt)` once at the boundary keeps every consumer
 * safe from "Invalid Date" slips and matches the convention used by
 * the rest of the modules.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  // ===========================================================================
  // Sessions
  // ===========================================================================

  /**
   * Open a session or recover the active one (idempotent).
   *
   * <p>Server contract (BE-6.4):
   * <ul>
   *   <li>{@code 201 Created} — a fresh session was opened.</li>
   *   <li>{@code 200 OK} — an active session already existed; the
   *       same payload is returned (the docente can resume scanning).</li>
   * </ul>
   */
  openSession(request: CreateSessionRequest): Observable<AttendanceSession> {
    return this.api
      .post<ApiResponse<AttendanceSessionResponseRaw>, CreateSessionRequest>(
        API.ATTENDANCE.SESSIONS_ROOT,
        request
      )
      .pipe(map((envelope) => this.toSession(envelope.data)));
  }

  closeSession(sessionPublicUuid: string): Observable<AttendanceSession> {
    return this.api
      .patch<ApiResponse<AttendanceSessionResponseRaw>>(
        API.ATTENDANCE.CLOSE_SESSION(sessionPublicUuid)
      )
      .pipe(map((envelope) => this.toSession(envelope.data)));
  }

  /**
   * Register a check-in. The backend stamps {@code wasIdempotent=true}
   * on the envelope when the record was already present; we surface
   * that on a sibling field for the scanner feedback chip to consume.
   */
  checkIn(
    sessionPublicUuid: string,
    request: CheckInRequest
  ): Observable<{ record: AttendanceRecord; wasIdempotent: boolean }> {
    return this.api
      .post<ApiResponse<AttendanceRecordResponseRaw> & { wasIdempotent?: boolean }, CheckInRequest>(
        API.ATTENDANCE.CHECK_IN(sessionPublicUuid),
        request
      )
      .pipe(
        map((envelope) => ({
          record: this.toRecord(envelope.data),
          wasIdempotent: Boolean((envelope as { wasIdempotent?: boolean }).wasIdempotent)
        }))
      );
  }

  /**
   * Roster of a session. Backend returns a flat array (no envelope) —
   * matches {@code GET /v1/academic/sections/{uuid}/students} which the
   * codebase already consumes as a raw array.
   */
  listRecords(sessionPublicUuid: string): Observable<AttendanceRecord[]> {
    return this.api
      .get<AttendanceRecordResponseRaw[]>(API.ATTENDANCE.SESSION_RECORDS(sessionPublicUuid))
      .pipe(map((rows) => rows.map((r) => this.toRecord(r))));
  }

  /**
   * Manual edit by TENANT_ADMIN. Endpoint is restricted server-side
   * to that role; the UI mirrors the same gate via {@code roleGuard}.
   */
  updateRecord(
    recordPublicUuid: string,
    patch: UpdateRecordRequest
  ): Observable<AttendanceRecord> {
    return this.api
      .put<ApiResponse<AttendanceRecordResponseRaw>, UpdateRecordRequest>(
        API.ATTENDANCE.RECORD_BY_ID(recordPublicUuid),
        patch
      )
      .pipe(map((envelope) => this.toRecord(envelope.data)));
  }

  // ===========================================================================
  // Student attendance QR (BE-6.3)
  // ===========================================================================

  /**
   * Download the QR credential as a binary blob. Caller decides the
   * format via the `format` argument, which is sent as the
   * `Accept` header. Defaults to `png`.
   */
  downloadQr(
    studentPublicUuid: string,
    format: 'png' | 'svg' = 'png'
  ): Observable<Blob> {
    const headers = new HttpHeaders({
      Accept: format === 'svg' ? 'image/svg+xml' : 'image/png'
    });
    return this.http.get(API.ATTENDANCE.STUDENT_QR(studentPublicUuid), {
      headers,
      responseType: 'blob'
    });
  }

  getQrInfo(studentPublicUuid: string): Observable<AttendanceQrInfo> {
    return this.api
      .get<ApiResponse<AttendanceQrInfoResponseRaw>>(
        API.ATTENDANCE.STUDENT_QR_INFO(studentPublicUuid)
      )
      .pipe(map((envelope) => this.toQrInfo(envelope.data)));
  }

  rotateQr(studentPublicUuid: string): Observable<AttendanceQrInfo> {
    return this.api
      .post<ApiResponse<AttendanceQrInfoResponseRaw>>(
        API.ATTENDANCE.STUDENT_QR_ROTATE(studentPublicUuid),
        {}
      )
      .pipe(map((envelope) => this.toQrInfo(envelope.data)));
  }

  // ===========================================================================
  // Adapters
  // ===========================================================================

  private toSession(raw: AttendanceSessionResponseRaw): AttendanceSession {
    return {
      publicUuid: raw.publicUuid,
      sectionPublicUuid: raw.sectionPublicUuid,
      sectionName: raw.sectionName ?? undefined,
      occurredOn: this.parseDate(raw.occurredOn) ?? new Date(),
      slot: raw.slot,
      startsAt: this.parseDate(raw.startsAt) ?? new Date(),
      closedAt: this.parseDate(raw.closedAt),
      closedByUserId: raw.closedByUserId ?? undefined,
      status: raw.status,
      notes: raw.notes ?? undefined,
      createdAt: this.parseDate(raw.createdAt) ?? new Date(),
      updatedAt: this.parseDate(raw.updatedAt) ?? new Date()
    };
  }

  private toRecord(raw: AttendanceRecordResponseRaw): AttendanceRecord {
    return {
      publicUuid: raw.publicUuid,
      sessionPublicUuid: raw.sessionPublicUuid,
      studentPublicUuid: raw.studentPublicUuid,
      studentFullName: raw.studentFullName ?? undefined,
      studentDocumentNumber: raw.studentDocumentNumber ?? undefined,
      status: raw.status,
      occurredAt: this.parseDate(raw.occurredAt) ?? new Date(),
      scannedByUserId: raw.scannedByUserId ?? undefined,
      editedByUserId: raw.editedByUserId ?? undefined,
      editedAt: this.parseDate(raw.editedAt),
      notes: raw.notes ?? undefined,
      createdAt: this.parseDate(raw.createdAt) ?? new Date(),
      updatedAt: this.parseDate(raw.updatedAt) ?? new Date()
    };
  }

  private toQrInfo(raw: AttendanceQrInfoResponseRaw): AttendanceQrInfo {
    return {
      publicUuid: raw.publicUuid,
      studentPublicUuid: raw.studentPublicUuid,
      version: raw.version,
      issuedAt: this.parseDate(raw.issuedAt) ?? new Date(),
      revokedAt: this.parseDate(raw.revokedAt),
      revokedReason: raw.revokedReason ?? undefined,
      lastRotatedAt: this.parseDate(raw.lastRotatedAt),
      active: raw.active
    };
  }

  private parseDate(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
}
